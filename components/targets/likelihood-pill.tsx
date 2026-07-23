import type { LikelihoodBand } from "@/lib/contacts/likelihood";

const BAND_STYLES: Record<LikelihoodBand, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  low: "bg-slate-100 text-slate-500 ring-slate-500/20",
};

/**
 * The "% likelihood" pill, colored by band. Confidence is surfaced as a subtle
 * suffix rather than a second badge so the number stays the focal point; a low
 * confidence reads as "we're not sure yet", not a low score.
 */
export function LikelihoodPill({
  score,
  band,
  confidence,
  size = "sm",
}: {
  score: number;
  band: LikelihoodBand;
  confidence: number;
  size?: "sm" | "lg";
}) {
  const lowConfidence = confidence < 40;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset ${BAND_STYLES[band]} ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
      title={`${confidence}% confidence in this estimate`}
    >
      {score}%
      {lowConfidence && (
        <span className="font-normal opacity-70">· low confidence</span>
      )}
    </span>
  );
}
