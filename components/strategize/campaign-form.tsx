"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, updateCampaign } from "@/lib/campaigns/actions";
import { Card, Field } from "@/components/brand/brand-basics-form";
import { SaveIndicator, useAutoSave } from "@/components/brand/use-autosave";

type CampaignFormValue = {
  title: string;
  objective: string;
  goalType:
    | ""
    | "AWARENESS"
    | "THOUGHT_LEADERSHIP"
    | "LAUNCH"
    | "CRISIS_RESPONSE"
    | "FUNDING"
    | "PARTNERSHIP";
  toneTags: string[];
  budgetRange: "" | "Under $5k" | "$5k-$25k" | "$25k-$100k" | "$100k+";
  marketSentimentNotes: string;
};

const TONE_CHIPS = [
  "Authoritative",
  "Warm",
  "Playful",
  "Urgent",
  "Academic",
  "Provocative",
] as const;

export function CampaignForm({
  campaignId,
  initial,
}: {
  campaignId?: string;
  initial: CampaignFormValue;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CampaignFormValue>(initial);
  const [creating, startCreate] = useTransition();

  const { state, errorMsg } = useAutoSave({
    value,
    skip: () => !campaignId || value.title.trim().length === 0,
    save: async (v) => {
      if (!campaignId) return { ok: true };
      return updateCampaign({
        id: campaignId,
        title: v.title,
        objective: v.objective || null,
        goalType: v.goalType || undefined,
        toneTags: v.toneTags,
        budgetRange: v.budgetRange || null,
        marketSentimentNotes: v.marketSentimentNotes || null,
      });
    },
  });

  function toggleTone(t: string) {
    setValue((v) => ({
      ...v,
      toneTags: v.toneTags.includes(t)
        ? v.toneTags.filter((x) => x !== t)
        : [...v.toneTags, t],
    }));
  }

  function handleCreate() {
    if (!value.title.trim()) return;
    startCreate(async () => {
      const res = await createCampaign({
        title: value.title,
        objective: value.objective || null,
        goalType: value.goalType || undefined,
        toneTags: value.toneTags,
        budgetRange: value.budgetRange || null,
        marketSentimentNotes: value.marketSentimentNotes || null,
      });
      if (res.ok) {
        router.replace(
          `/dashboard/strategize/ideation?campaignId=${res.campaign.id}`,
        );
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Card
      title={campaignId ? "Campaign setup" : "New campaign"}
      indicator={campaignId ? <SaveIndicator state={state} errorMsg={errorMsg} /> : null}
    >
      <Field label="Campaign title" required>
        <input
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          placeholder="Q2 Product Launch"
        />
      </Field>

      <Field label="Topic / what we're announcing">
        <textarea
          rows={2}
          value={value.objective}
          onChange={(e) => setValue({ ...value, objective: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Primary goal">
        <select
          value={value.goalType}
          onChange={(e) =>
            setValue({
              ...value,
              goalType: e.target.value as CampaignFormValue["goalType"],
            })
          }
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="AWARENESS">Awareness</option>
          <option value="THOUGHT_LEADERSHIP">Thought Leadership</option>
          <option value="LAUNCH">Launch</option>
          <option value="CRISIS_RESPONSE">Crisis Response</option>
          <option value="FUNDING">Funding</option>
          <option value="PARTNERSHIP">Partnership</option>
        </select>
      </Field>

      <Field label="Tone">
        <div className="flex flex-wrap gap-2">
          {TONE_CHIPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTone(t)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                value.toneTags.includes(t)
                  ? "border-brand-pink bg-brand-pink text-white"
                  : "border-border bg-white text-brand-navy hover:border-brand-pink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Budget range">
        <select
          value={value.budgetRange}
          onChange={(e) =>
            setValue({
              ...value,
              budgetRange: e.target.value as CampaignFormValue["budgetRange"],
            })
          }
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">— pick one —</option>
          <option>Under $5k</option>
          <option>$5k-$25k</option>
          <option>$25k-$100k</option>
          <option>$100k+</option>
        </select>
      </Field>

      <Field
        label="Market sentiment notes"
        hint="What's happening in the market right now?"
      >
        <textarea
          rows={3}
          value={value.marketSentimentNotes}
          onChange={(e) =>
            setValue({ ...value, marketSentimentNotes: e.target.value })
          }
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      {!campaignId && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !value.title.trim()}
          className="mt-2 w-full rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create campaign →"}
        </button>
      )}
    </Card>
  );
}
