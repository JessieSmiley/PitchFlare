"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  // Keep raw, user-typed strings for CSV fields so commas and trailing
  // spaces survive between keystrokes. We parse to arrays only on save.
  const [toneRaw, setToneRaw] = useState<string>(initial.toneAttributes.join(", "));
  const [bannedRaw, setBannedRaw] = useState<string>(initial.bannedWords.join(", "));
  const [analyzing, startAnalyze] = useTransition();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // When the parent updates the voice arrays (e.g. after AI analyze), sync
  // the raw strings so the inputs reflect the new values.
  const lastToneArr = useRef<string[]>(initial.toneAttributes);
  const lastBannedArr = useRef<string[]>(initial.bannedWords);
  useEffect(() => {
    if (!sameArr(value.toneAttributes, lastToneArr.current)) {
      lastToneArr.current = value.toneAttributes;
      setToneRaw(value.toneAttributes.join(", "));
    }
    if (!sameArr(value.bannedWords, lastBannedArr.current)) {
      lastBannedArr.current = value.bannedWords;
      setBannedRaw(value.bannedWords.join(", "));
    }
  }, [value.toneAttributes, value.bannedWords]);

  const { state, errorMsg, forceSaveNow } = useAutoSave({
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

  function commitToneRaw(raw: string) {
    const next = splitCsv(raw);
    if (!sameArr(next, value.toneAttributes)) {
      lastToneArr.current = next;
      setValue((v) => ({ ...v, toneAttributes: next }));
    }
  }
  function commitBannedRaw(raw: string) {
    const next = splitCsv(raw);
    if (!sameArr(next, value.bannedWords)) {
      lastBannedArr.current = next;
      setValue((v) => ({ ...v, bannedWords: next }));
    }
  }

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
      indicator={
        <div className="flex items-center gap-2">
          <SaveIndicator state={state} errorMsg={errorMsg} />
          <button
            type="button"
            onClick={() => {
              commitToneRaw(toneRaw);
              commitBannedRaw(bannedRaw);
              void forceSaveNow();
            }}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            Save now
          </button>
        </div>
      }
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
          value={toneRaw}
          onChange={(e) => setToneRaw(e.target.value)}
          onBlur={(e) => commitToneRaw(e.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="What we always do"
        hint="One or two sentences. e.g. Lead with customer outcomes, cite a number in the first paragraph, end with a clear ask."
      >
        <textarea
          rows={2}
          value={value.alwaysDo}
          onChange={(e) => setValue({ ...value, alwaysDo: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="What we never do"
        hint="One or two sentences. e.g. Never use hype superlatives ('revolutionary', 'game-changer'), never make claims we can't back with a source."
      >
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
          value={bannedRaw}
          onChange={(e) => setBannedRaw(e.target.value)}
          onBlur={(e) => commitBannedRaw(e.target.value)}
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

function sameArr(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
