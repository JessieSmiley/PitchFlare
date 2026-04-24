"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactTable, type ContactRow } from "./contact-table";
import { ContactDrawer, type ContactDetail } from "./contact-drawer";
import { buildTargetListFromAngle } from "@/lib/contacts/actions";

export function TargetsShell({
  campaignId,
  primaryAngleTitle,
  contacts,
  contactDetails,
}: {
  campaignId: string | null;
  primaryAngleTitle: string | null;
  contacts: ContactRow[];
  contactDetails: Record<string, ContactDetail>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [buildPending, startBuild] = useTransition();
  const [buildMessage, setBuildMessage] = useState<string | null>(null);

  function buildTargetList() {
    if (!campaignId) return;
    setBuildMessage(null);
    startBuild(async () => {
      const res = await buildTargetListFromAngle({ campaignId });
      if (!res.ok) {
        setBuildMessage(res.error);
        return;
      }
      setBuildMessage(`Created list with ${res.count} contacts.`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {campaignId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <h2 className="font-display text-lg text-brand-navy">
                Build target list
              </h2>
              <p className="text-xs text-muted-foreground">
                {primaryAngleTitle
                  ? `Ranks contacts against "${primaryAngleTitle}".`
                  : "Set a primary angle on Ideation first to get a scored ranking."}
              </p>
            </div>
            <button
              type="button"
              onClick={buildTargetList}
              disabled={buildPending || !primaryAngleTitle}
              className="rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {buildPending ? "Scoring…" : "✦ Find contacts for this angle"}
            </button>
          </div>
        )}

        {buildMessage && (
          <p className="text-xs text-muted-foreground">{buildMessage}</p>
        )}

        <ContactTable contacts={contacts} onSelect={setSelected} />
      </div>

      <ContactDrawer
        contact={selected ? contactDetails[selected] ?? null : null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
