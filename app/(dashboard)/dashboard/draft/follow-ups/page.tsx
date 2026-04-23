import { PhaseStub } from "@/components/phase-stub";

export default function FollowUpsPage() {
  return (
    <PhaseStub
      n={3}
      title="Follow-ups"
      description="Draft 1st / 2nd / 3rd-touch follow-ups with escalating hooks. Auto-drafted when a pitch hasn't been opened after 4 days (requires user approval before send)."
      chunk="Chunk F"
    />
  );
}
