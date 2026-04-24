import { PhaseStub } from "@/components/phase-stub";

export default function SentimentPage() {
  return (
    <PhaseStub
      n={5}
      title="Sentiment"
      description="Claude-scored sentiment (positive / neutral / negative) with confidence and rationale per coverage clip."
      chunk="Chunk G"
    />
  );
}
