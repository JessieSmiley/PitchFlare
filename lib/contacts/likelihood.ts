/**
 * "Likelihood to Cover" — a behavioral coverage-propensity score.
 *
 * This is deliberately NOT the topical match in `match.ts`. That one answers
 * "does this person write about this subject?" (beat + keyword overlap). This
 * one answers the more actionable question a PR consultant actually asks:
 * "given how this journalist *behaves*, how likely are they to cover MY news
 * right now?" — and, crucially, it explains why.
 *
 * The score is a weighted, normalized sum of behavioral signals. Every signal
 * yields a sub-score in [0,1] and a fixed weight; the weights encode the
 * business intuition (a prior reply to your brand matters far more than a
 * generic beat match). Signals with no backing data are marked UNAVAILABLE —
 * they contribute nothing and drag `confidence` down rather than silently
 * inflating or deflating the number.
 *
 * This module is intentionally pure: no DB, no network, no `@/` imports. Data
 * loading and the Claude-generated rationale live in `likelihood-service.ts`
 * so the math here stays trivially unit-testable and deterministic.
 */

/**
 * ContactField keys backing the two manual/AI-inferred flag signals. Defined
 * here (the pure, client-safe module) so both the server service and the
 * client drawer can reference them without either importing the other.
 */
export const EXCLUSIVES_FIELD_KEY = "prefersExclusives";
export const PR_DRIVEN_FIELD_KEY = "prDrivenPropensity";

export type SignalKey =
  | "respondedBefore"
  | "coveredTopic30d"
  | "coveredCompetitor"
  | "coversCategory"
  | "prefersExclusives"
  | "cadence"
  | "prDrivenAverse";

/**
 * Signal weights, mapping the product's High/Very-high/Medium/Negative labels
 * to numbers. `prDrivenAverse` is the one penalty: it *subtracts* — a
 * journalist who rarely bites on press-release-driven stories is less likely
 * to run your pitch. Positive weights sum to POSITIVE_WEIGHT_TOTAL, which is
 * the denominator the final percentage is normalized against.
 */
export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  respondedBefore: 3.0, // Very high
  coveredTopic30d: 2.5, // High
  coveredCompetitor: 2.5, // High
  coversCategory: 1.5, // Medium
  prefersExclusives: 1.5, // Medium
  cadence: 1.5, // Medium
  prDrivenAverse: -2.0, // Negative (penalty)
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  respondedBefore: "Responded to your brand before",
  coveredTopic30d: "Covered your topic in the last 30 days",
  coveredCompetitor: "Recently covered a competitor",
  coversCategory: "Regularly covers this news category",
  prefersExclusives: "Prefers exclusives",
  cadence: "Active publication cadence",
  prDrivenAverse: "Rarely writes press-release-driven stories",
};

/** Sum of the positive signal weights — the normalization denominator. */
export const POSITIVE_WEIGHT_TOTAL = (
  Object.keys(SIGNAL_WEIGHTS) as SignalKey[]
).reduce((sum, k) => (SIGNAL_WEIGHTS[k] > 0 ? sum + SIGNAL_WEIGHTS[k] : sum), 0);

/** Total absolute weight (incl. the penalty), used for the confidence ratio. */
const TOTAL_ABS_WEIGHT = (Object.keys(SIGNAL_WEIGHTS) as SignalKey[]).reduce(
  (sum, k) => sum + Math.abs(SIGNAL_WEIGHTS[k]),
  0,
);

/** Default lexicon for the "covers this news category" signal (funding-led). */
export const FUNDING_LEXICON = [
  "funding",
  "raised",
  "raises",
  "series a",
  "series b",
  "series c",
  "seed round",
  "venture",
  "vc",
  "valuation",
  "investment",
  "investors",
  "round",
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * A manual/inferred flag (e.g. "prefers exclusives"). `value` is the sub-score
 * in [0,1] or null when we have no data at all. `inferred` drives the UI badge
 * and lets us discount an AI guess vs. a human-confirmed value.
 */
export type FlagSignal = { value: number | null; inferred: boolean };

export type RecentWorkItem = {
  title: string;
  excerpt?: string | null;
  publishedAt: Date | null;
};

export type LikelihoodInputs = {
  /** Reference time; defaults to now(). Injected so tests are deterministic. */
  now?: Date;

  // ── Responded before (brand-scoped) ──
  replyCount: number;
  lastReplyAt: Date | null;
  pitchedCount: number;

  // ── Coverage corpus (used by several signals) ──
  recentWork: RecentWorkItem[];

  // ── Covered topic in last 30 days ──
  /** Campaign/angle terms. Empty → signal UNAVAILABLE. */
  topicTerms: string[];

  // ── Covered competitor ──
  /** Brand competitor names. Empty → signal UNAVAILABLE. */
  competitorNames: string[];

  // ── Covers this news category ──
  /** Defaults to FUNDING_LEXICON. */
  categoryTerms?: string[];

  // ── Manual / AI-inferred flags ──
  prefersExclusives: FlagSignal;
  prDrivenAverse: FlagSignal;
};

export type SignalContribution = {
  key: SignalKey;
  label: string;
  weight: number;
  /** [0,1] strength of the signal, or null when there was no data. */
  subScore: number | null;
  /** weight × subScore (signed). 0 when unavailable. */
  points: number;
  /** True when this signal had backing data and counted. */
  available: boolean;
  /** True for the negative penalty signal. */
  penalty: boolean;
  /** Whether the value was AI-inferred (only meaningful for flag signals). */
  inferred: boolean;
  /** Human phrase for the breakdown UI and the rationale generator. */
  detail: string;
};

export type LikelihoodResult = {
  /** 0–100 headline percentage. */
  score: number;
  /** 0–100 share of signal weight that had backing data. */
  confidence: number;
  breakdown: SignalContribution[];
};

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY;
}

function pluralize(n: number, word: string): string {
  if (n === 1) return `1 ${word}`;
  // Handle the handful of forms these details actually use (story → stories).
  const plural = /[^aeiou]y$/.test(word) ? word.replace(/y$/, "ies") : `${word}s`;
  return `${n} ${plural}`;
}

function agoPhrase(from: Date, to: Date): string {
  const d = Math.round(daysBetween(from, to));
  if (d <= 1) return "in the last day";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${Math.round(d / 30)} months ago`;
  return "over a year ago";
}

// ── Individual signal computations ──────────────────────────────────────────
// Each returns { subScore, available, detail }. subScore is null when the
// signal has no data to stand on.

type SignalOut = { subScore: number | null; available: boolean; detail: string };

function scoreRespondedBefore(i: LikelihoodInputs, now: Date): SignalOut {
  // No relationship yet → unavailable (we can't know propensity to reply).
  if (i.pitchedCount === 0 && i.replyCount === 0) {
    return { subScore: null, available: false, detail: "No prior outreach on record" };
  }
  if (i.replyCount === 0) {
    return {
      subScore: 0,
      available: true,
      detail: `Pitched ${pluralize(i.pitchedCount, "time")} with no reply`,
    };
  }
  let base = i.replyCount >= 2 ? 1.0 : 0.7;
  // Recency decay — a reply two years ago says less about today.
  if (i.lastReplyAt) {
    const age = daysBetween(now, i.lastReplyAt);
    if (age > 365) base *= 0.6;
    else if (age > 180) base *= 0.8;
  }
  const when = i.lastReplyAt ? ` (most recent ${agoPhrase(i.lastReplyAt, now)})` : "";
  return {
    subScore: base,
    available: true,
    detail: `Replied to your outreach ${pluralize(i.replyCount, "time")}${when}`,
  };
}

function scoreCoveredTopic30d(i: LikelihoodInputs, now: Date): SignalOut {
  if (i.topicTerms.length === 0) {
    return { subScore: null, available: false, detail: "No campaign topic set" };
  }
  const tokens = new Set(i.topicTerms.flatMap(tokenize));
  const matches = i.recentWork.filter((rw) => {
    if (!rw.publishedAt || daysBetween(now, rw.publishedAt) > 30) return false;
    const hay = `${rw.title} ${rw.excerpt ?? ""}`.toLowerCase();
    return [...tokens].some((t) => hay.includes(t));
  });
  const n = matches.length;
  // Presence-boosted: even one on-topic story in 30 days is meaningful; three
  // is a strong "they're actively on this beat right now" signal.
  const subScore = n >= 3 ? 1.0 : n === 2 ? 0.85 : n === 1 ? 0.6 : 0;
  const detail =
    n === 0
      ? "No on-topic stories in the last 30 days"
      : `Published ${pluralize(n, "story")} on your topic in the last 30 days`;
  return { subScore, available: true, detail };
}

function scoreCoveredCompetitor(i: LikelihoodInputs, now: Date): SignalOut {
  if (i.competitorNames.length === 0) {
    return { subScore: null, available: false, detail: "No competitors configured" };
  }
  // Keep the original casing for display; match case-insensitively.
  const names = i.competitorNames
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);
  let best: { name: string; age: number } | null = null;
  for (const rw of i.recentWork) {
    const hay = `${rw.title} ${rw.excerpt ?? ""}`.toLowerCase();
    const hit = names.find((n) => hay.includes(n.toLowerCase()));
    if (!hit) continue;
    const age = rw.publishedAt ? daysBetween(now, rw.publishedAt) : 9999;
    if (!best || age < best.age) best = { name: hit, age };
  }
  if (!best) {
    return { subScore: 0, available: true, detail: "No competitor coverage found" };
  }
  const subScore = best.age <= 60 ? 1.0 : best.age <= 180 ? 0.7 : 0.4;
  return {
    subScore,
    available: true,
    detail: `Recently covered a competitor (${best.name})`,
  };
}

function scoreCoversCategory(i: LikelihoodInputs): SignalOut {
  if (i.recentWork.length === 0) {
    return { subScore: null, available: false, detail: "No recent work on file" };
  }
  const terms = (i.categoryTerms ?? FUNDING_LEXICON).map((t) => t.toLowerCase());
  const matches = i.recentWork.filter((rw) => {
    const hay = `${rw.title} ${rw.excerpt ?? ""}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
  const ratio = matches.length / i.recentWork.length;
  // 40%+ of the corpus on-category is a firm "this is their lane" → full score.
  const subScore = Math.min(1, ratio / 0.4);
  const pct = Math.round(ratio * 100);
  const detail =
    matches.length === 0
      ? "Doesn't usually cover this category"
      : `Category is ~${pct}% of recent coverage (${pluralize(matches.length, "story")})`;
  return { subScore, available: true, detail };
}

function scoreCadence(i: LikelihoodInputs, now: Date): SignalOut {
  const dated = i.recentWork
    .map((rw) => rw.publishedAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());
  if (dated.length < 2) {
    return { subScore: null, available: false, detail: "Not enough dated work to gauge cadence" };
  }
  // Median gap between consecutive posts.
  const gaps: number[] = [];
  for (let k = 0; k < dated.length - 1; k++) {
    gaps.push(daysBetween(dated[k], dated[k + 1]));
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)];
  let subScore =
    medianGap <= 10 ? 1.0 : medianGap <= 30 ? 0.75 : medianGap <= 60 ? 0.5 : medianGap <= 120 ? 0.25 : 0.1;
  // A dormant byline (nothing recent) is hard to reach regardless of history.
  const sinceLast = daysBetween(now, dated[0]);
  if (sinceLast > 120) subScore = Math.min(subScore, 0.2);
  const cadenceWord =
    medianGap <= 10 ? "several times a week" : medianGap <= 30 ? "roughly weekly" : medianGap <= 60 ? "a few times a month" : "occasionally";
  const detail =
    sinceLast > 120 ? "Byline has gone quiet recently" : `Publishes ${cadenceWord}`;
  return { subScore, available: true, detail };
}

function scoreFlag(flag: FlagSignal, yes: string, no: string): SignalOut {
  if (flag.value === null) {
    return { subScore: null, available: false, detail: "Unknown" };
  }
  const suffix = flag.inferred ? " (inferred)" : "";
  return {
    subScore: flag.value,
    available: true,
    detail: (flag.value >= 0.5 ? yes : no) + suffix,
  };
}

/**
 * Compute the Likelihood-to-Cover score from fully-resolved inputs. Pure and
 * deterministic — the whole point of keeping DB/AI out of this file.
 */
export function computeLikelihood(inputs: LikelihoodInputs): LikelihoodResult {
  const now = inputs.now ?? new Date();

  const outs: Record<SignalKey, SignalOut> = {
    respondedBefore: scoreRespondedBefore(inputs, now),
    coveredTopic30d: scoreCoveredTopic30d(inputs, now),
    coveredCompetitor: scoreCoveredCompetitor(inputs, now),
    coversCategory: scoreCoversCategory(inputs),
    cadence: scoreCadence(inputs, now),
    prefersExclusives: scoreFlag(
      inputs.prefersExclusives,
      "Prefers exclusives",
      "Open to non-exclusive stories",
    ),
    prDrivenAverse: scoreFlag(
      inputs.prDrivenAverse,
      "Rarely writes press-release-driven stories",
      "Open to press-release-driven stories",
    ),
  };

  const flagInferred: Record<SignalKey, boolean> = {
    respondedBefore: false,
    coveredTopic30d: false,
    coveredCompetitor: false,
    coversCategory: false,
    cadence: false,
    prefersExclusives: inputs.prefersExclusives.inferred,
    prDrivenAverse: inputs.prDrivenAverse.inferred,
  };

  const breakdown: SignalContribution[] = (Object.keys(SIGNAL_WEIGHTS) as SignalKey[]).map(
    (key) => {
      const weight = SIGNAL_WEIGHTS[key];
      const out = outs[key];
      const penalty = weight < 0;
      const points = out.available && out.subScore !== null ? weight * out.subScore : 0;
      return {
        key,
        label: SIGNAL_LABELS[key],
        weight,
        subScore: out.subScore,
        points,
        available: out.available,
        penalty,
        inferred: flagInferred[key],
        detail: out.detail,
      };
    },
  );

  const raw = breakdown.reduce((sum, b) => sum + b.points, 0);
  const score = Math.round(clamp(raw / POSITIVE_WEIGHT_TOTAL, 0, 1) * 100);

  const availableWeight = breakdown
    .filter((b) => b.available)
    .reduce((sum, b) => sum + Math.abs(b.weight), 0);
  const confidence = Math.round((availableWeight / TOTAL_ABS_WEIGHT) * 100);

  return { score, confidence, breakdown };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Deterministic, no-AI rationale. Strings the strongest positive signals into
 * one sentence, appends the penalty caveat if it fired. Used as the default in
 * the contact table (where we don't want an AI call per row) and as the
 * fallback when Claude is unavailable.
 */
export function buildRationale(result: LikelihoodResult): string {
  const positives = result.breakdown
    .filter((b) => b.available && !b.penalty && (b.subScore ?? 0) > 0.25)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((b) => lowerFirst(b.detail));

  const penalty = result.breakdown.find(
    (b) => b.penalty && b.available && (b.subScore ?? 0) >= 0.5,
  );

  if (positives.length === 0) {
    return penalty
      ? `Limited positive signals, and ${lowerFirst(penalty.detail).replace(" (inferred)", "")}.`
      : "Not enough behavioral signal yet to gauge coverage likelihood.";
  }

  let sentence = capitalize(joinClauses(positives)) + ".";
  if (penalty) {
    sentence = sentence.replace(/\.$/, "") + `, though they ${penaltyClause(penalty.detail)}.`;
  }
  return sentence;
}

function penaltyClause(detail: string): string {
  return lowerFirst(detail).replace(" (inferred)", "").replace(/^rarely/, "rarely");
}

function joinClauses(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export type LikelihoodBand = "high" | "medium" | "low";

/** Coarse band for pill coloring in the UI. */
export function likelihoodBand(score: number): LikelihoodBand {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * The likelihood payload the UI carries per contact. `breakdown` is only
 * present on the detail (drawer) view — the table row omits it to stay light.
 */
export type ContactLikelihood = {
  score: number;
  confidence: number;
  band: LikelihoodBand;
  rationale: string;
  breakdown?: SignalContribution[];
};
