import { describe, expect, it } from "vitest";
import {
  buildRationale,
  computeLikelihood,
  likelihoodBand,
  POSITIVE_WEIGHT_TOTAL,
  SIGNAL_WEIGHTS,
  type FlagSignal,
  type LikelihoodInputs,
  type RecentWorkItem,
} from "./likelihood";

const NOW = new Date("2026-07-23T00:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

const UNKNOWN_FLAG: FlagSignal = { value: null, inferred: false };

/** A contact with no data at all — every signal should be unavailable. */
function emptyInputs(overrides: Partial<LikelihoodInputs> = {}): LikelihoodInputs {
  return {
    now: NOW,
    replyCount: 0,
    lastReplyAt: null,
    pitchedCount: 0,
    recentWork: [],
    topicTerms: [],
    competitorNames: [],
    prefersExclusives: UNKNOWN_FLAG,
    prDrivenAverse: UNKNOWN_FLAG,
    ...overrides,
  };
}

describe("weights", () => {
  it("positive weights total the normalization denominator", () => {
    const manualTotal = 3.0 + 2.5 + 2.5 + 1.5 + 1.5 + 1.5;
    expect(POSITIVE_WEIGHT_TOTAL).toBeCloseTo(manualTotal);
  });

  it("only prDrivenAverse is a penalty", () => {
    const negatives = Object.entries(SIGNAL_WEIGHTS).filter(([, w]) => w < 0);
    expect(negatives).toEqual([["prDrivenAverse", -2.0]]);
  });
});

describe("computeLikelihood — empty contact", () => {
  it("scores 0 with 0 confidence when nothing is known", () => {
    const r = computeLikelihood(emptyInputs());
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
    expect(r.breakdown.every((b) => !b.available)).toBe(true);
  });
});

describe("respondedBefore", () => {
  it("is unavailable when never pitched", () => {
    const r = computeLikelihood(emptyInputs());
    const s = r.breakdown.find((b) => b.key === "respondedBefore")!;
    expect(s.available).toBe(false);
  });

  it("counts as available-but-zero when pitched and ghosted", () => {
    const r = computeLikelihood(emptyInputs({ pitchedCount: 2 }));
    const s = r.breakdown.find((b) => b.key === "respondedBefore")!;
    expect(s.available).toBe(true);
    expect(s.subScore).toBe(0);
  });

  it("rewards multiple recent replies at full strength", () => {
    const r = computeLikelihood(
      emptyInputs({ pitchedCount: 3, replyCount: 2, lastReplyAt: daysAgo(20) }),
    );
    const s = r.breakdown.find((b) => b.key === "respondedBefore")!;
    expect(s.subScore).toBe(1);
    expect(s.points).toBe(3);
  });

  it("decays an old reply", () => {
    const recent = computeLikelihood(
      emptyInputs({ pitchedCount: 1, replyCount: 1, lastReplyAt: daysAgo(10) }),
    ).breakdown.find((b) => b.key === "respondedBefore")!;
    const old = computeLikelihood(
      emptyInputs({ pitchedCount: 1, replyCount: 1, lastReplyAt: daysAgo(400) }),
    ).breakdown.find((b) => b.key === "respondedBefore")!;
    expect(old.subScore!).toBeLessThan(recent.subScore!);
  });
});

describe("coveredTopic30d", () => {
  const cyber: RecentWorkItem[] = [
    { title: "Cybersecurity startup raises Series B", excerpt: null, publishedAt: daysAgo(3) },
    { title: "Cyber attack wave hits banks", excerpt: null, publishedAt: daysAgo(10) },
    { title: "Cyber funding roundup", excerpt: null, publishedAt: daysAgo(14) },
  ];

  it("is unavailable without topic terms", () => {
    const r = computeLikelihood(emptyInputs({ recentWork: cyber }));
    expect(r.breakdown.find((b) => b.key === "coveredTopic30d")!.available).toBe(false);
  });

  it("hits full strength with three on-topic stories in 30 days", () => {
    const r = computeLikelihood(
      emptyInputs({ recentWork: cyber, topicTerms: ["cybersecurity", "cyber"] }),
    );
    const s = r.breakdown.find((b) => b.key === "coveredTopic30d")!;
    expect(s.subScore).toBe(1);
  });

  it("ignores on-topic stories older than 30 days", () => {
    const stale: RecentWorkItem[] = [
      { title: "Cyber deep dive", excerpt: null, publishedAt: daysAgo(60) },
    ];
    const r = computeLikelihood(
      emptyInputs({ recentWork: stale, topicTerms: ["cyber"] }),
    );
    expect(r.breakdown.find((b) => b.key === "coveredTopic30d")!.subScore).toBe(0);
  });
});

describe("coveredCompetitor", () => {
  it("fires when a competitor name appears in recent work", () => {
    const r = computeLikelihood(
      emptyInputs({
        recentWork: [
          { title: "Interview with Acme Security's CEO", excerpt: null, publishedAt: daysAgo(15) },
        ],
        competitorNames: ["Acme Security"],
      }),
    );
    const s = r.breakdown.find((b) => b.key === "coveredCompetitor")!;
    expect(s.subScore).toBe(1);
    expect(s.detail).toContain("Acme Security");
  });

  it("is available-but-zero when competitors are set but not covered", () => {
    const r = computeLikelihood(
      emptyInputs({
        recentWork: [{ title: "Unrelated story", excerpt: null, publishedAt: daysAgo(5) }],
        competitorNames: ["Acme"],
      }),
    );
    const s = r.breakdown.find((b) => b.key === "coveredCompetitor")!;
    expect(s.available).toBe(true);
    expect(s.subScore).toBe(0);
  });
});

describe("coversCategory (funding by default)", () => {
  it("scores high when funding dominates the corpus", () => {
    const r = computeLikelihood(
      emptyInputs({
        recentWork: [
          { title: "Startup raises $20M Series A", excerpt: null, publishedAt: daysAgo(5) },
          { title: "VC funding hits record", excerpt: null, publishedAt: daysAgo(9) },
        ],
      }),
    );
    expect(r.breakdown.find((b) => b.key === "coversCategory")!.subScore).toBe(1);
  });
});

describe("cadence", () => {
  it("is unavailable with fewer than two dated items", () => {
    const r = computeLikelihood(
      emptyInputs({ recentWork: [{ title: "x", excerpt: null, publishedAt: daysAgo(3) }] }),
    );
    expect(r.breakdown.find((b) => b.key === "cadence")!.available).toBe(false);
  });

  it("rewards a tight, recent publishing rhythm", () => {
    const r = computeLikelihood(
      emptyInputs({
        recentWork: [
          { title: "a", excerpt: null, publishedAt: daysAgo(2) },
          { title: "b", excerpt: null, publishedAt: daysAgo(9) },
          { title: "c", excerpt: null, publishedAt: daysAgo(16) },
        ],
      }),
    );
    expect(r.breakdown.find((b) => b.key === "cadence")!.subScore).toBe(1);
  });

  it("caps a dormant byline even if historic cadence was tight", () => {
    const r = computeLikelihood(
      emptyInputs({
        recentWork: [
          { title: "a", excerpt: null, publishedAt: daysAgo(200) },
          { title: "b", excerpt: null, publishedAt: daysAgo(205) },
        ],
      }),
    );
    expect(r.breakdown.find((b) => b.key === "cadence")!.subScore).toBeLessThanOrEqual(0.2);
  });
});

describe("flag signals", () => {
  it("penalizes a PR-averse journalist (lower final score)", () => {
    const base = emptyInputs({ pitchedCount: 1, replyCount: 2, lastReplyAt: daysAgo(10) });
    const without = computeLikelihood(base).score;
    const withPenalty = computeLikelihood({
      ...base,
      prDrivenAverse: { value: 1, inferred: false },
    }).score;
    expect(withPenalty).toBeLessThan(without);
  });

  it("marks an inferred flag as inferred in the breakdown", () => {
    const r = computeLikelihood(
      emptyInputs({ prefersExclusives: { value: 0.5, inferred: true } }),
    );
    const s = r.breakdown.find((b) => b.key === "prefersExclusives")!;
    expect(s.inferred).toBe(true);
    expect(s.detail).toContain("inferred");
  });
});

describe("full 'hot lead' profile reproduces the ~87% example", () => {
  const r = computeLikelihood(
    emptyInputs({
      pitchedCount: 2,
      replyCount: 2,
      lastReplyAt: daysAgo(21),
      topicTerms: ["cybersecurity", "funding"],
      competitorNames: ["Acme Security"],
      recentWork: [
        { title: "Cybersecurity firm raises Series B funding", excerpt: null, publishedAt: daysAgo(4) },
        { title: "Acme Security CEO on the funding climate", excerpt: null, publishedAt: daysAgo(8) },
        { title: "Series A cyber roundup", excerpt: null, publishedAt: daysAgo(12) },
        { title: "Ransomware and venture funding", excerpt: null, publishedAt: daysAgo(20) },
      ],
      prefersExclusives: { value: 0.5, inferred: true },
    }),
  );

  it("lands in a high band in the 80s–90s", () => {
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThanOrEqual(95);
    expect(likelihoodBand(r.score)).toBe("high");
  });

  it("produces an actionable, grounded rationale", () => {
    const text = buildRationale(r);
    expect(text.toLowerCase()).toContain("topic");
    expect(text).toContain("competitor");
    expect(text.endsWith(".")).toBe(true);
  });

  it("reports high confidence when most signals have data", () => {
    expect(r.confidence).toBeGreaterThanOrEqual(70);
  });
});

describe("likelihoodBand", () => {
  it("bands by threshold", () => {
    expect(likelihoodBand(90)).toBe("high");
    expect(likelihoodBand(70)).toBe("high");
    expect(likelihoodBand(55)).toBe("medium");
    expect(likelihoodBand(40)).toBe("medium");
    expect(likelihoodBand(20)).toBe("low");
  });
});
