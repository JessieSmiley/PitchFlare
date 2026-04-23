"use client";

import { useState, useTransition } from "react";
import { analyzeWebsiteForVoice, updateBrandVoice } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";
import { SaveIndicator, useAutoSave } from "./use-autosave";

type Voice = {
  toneAttributes: string[];
  bannedWords: string[];
  alwaysDo: string;
  neverDo: string;
  styleNotes: string;
  sampleCorpus: string;
};

export function BrandVoiceForm({
  brandId,
  website,
  initial,
}: {
  brandId: string;
  website: string | null;
  initial: Voice;
}) {
  const [value, setValue] = useState<Voice>(initial);
  const [analyzing, startAnalyze] = useTransition();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const { state, errorMsg } = useAutoSave({
    value,
    save: async (v) =>
      updateBrandVoice({
        brandId,
        toneAttributes: v.toneAttributes,
        bannedWords: v.bannedWords,
        alwaysDo: v.alwaysDo || null,
        neverDo: v.neverDo || null,
        styleNotes: v.styleNotes || null,
        sampleCorpus: v.sampleCorpus || null,
      }),
  });

  function analyze() {
    if (!website) {
      setAnalyzeError("Add a website URL in Brand basics first.");
      return;
    }
    setAnalyzeError(null);
    startAnalyze(async () => {
      const res = await analyzeWebsiteForVoice({ brandId, url: website });
      if (!res.ok) {
        setAnalyzeError(res.error);
        return;
      }
      // Merge AI suggestions into local state. User can still edit before
      // debounced autosave fires.
      setValue((v) => ({
        ...v,
        toneAttributes:
          res.voice.toneAttributes.length > 0
            ? res.voice.toneAttributes
            : v.toneAttributes,
        alwaysDo: res.voice.alwaysDo || v.alwaysDo,
        neverDo: res.voice.neverDo || v.neverDo,
        styleNotes: res.voice.styleNotes || v.styleNotes,
        bannedWords: res.voice.suggestedBannedWords?.length
          ? Array.from(new Set([...v.bannedWords, ...res.voice.suggestedBannedWords]))
          : v.bannedWords,
      }));
    });
  }

  return (
    <Card
      title="Brand voice"
      indicator={<SaveIndicator state={state} errorMsg={errorMsg} />}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          This is injected into every AI prompt — pitches, releases, status
          briefs. Make it specific.
        </p>
        <button
          type="button"
          onClick={analyze}
          disabled={analyzing}
          className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
        >
          {analyzing ? "Analyzing…" : "✦ Analyze my website"}
        </button>
      </div>
      {analyzeError && (
        <p className="text-xs text-destructive">{analyzeError}</p>
      )}

      <Field
        label="Tone attributes"
        hint="Comma-separated single-word descriptors (e.g. confident, warm, direct)."
      >
        <input
          value={value.toneAttributes.join(", ")}
          onChange={(e) =>
            setValue({
              ...value,
              toneAttributes: splitCsv(e.target.value),
            })
          }
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field label="What we always do">
        <textarea
          rows={2}
          value={value.alwaysDo}
          onChange={(e) => setValue({ ...value, alwaysDo: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field label="What we never do">
        <textarea
          rows={2}
          value={value.neverDo}
          onChange={(e) => setValue({ ...value, neverDo: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="Style notes"
        hint="Sentence length, formatting, rhetorical devices."
      >
        <textarea
          rows={3}
          value={value.styleNotes}
          onChange={(e) => setValue({ ...value, styleNotes: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="Banned words"
        hint="Comma-separated words or phrases to avoid."
      >
        <input
          value={value.bannedWords.join(", ")}
          onChange={(e) =>
            setValue({ ...value, bannedWords: splitCsv(e.target.value) })
          }
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="Sample writing corpus"
        hint="Paste a prior press release or long-form post so the AI can match cadence (optional)."
      >
        <textarea
          rows={4}
          value={value.sampleCorpus}
          onChange={(e) => setValue({ ...value, sampleCorpus: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>
    </Card>
  );
}

function splitCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
