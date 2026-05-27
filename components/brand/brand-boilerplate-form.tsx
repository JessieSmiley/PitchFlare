"use client";

import { useState } from "react";
import { updateDefaultBoilerplate } from "@/lib/brand/actions";
import { Card, Field } from "./brand-basics-form";
import { SaveIndicator, useAutoSave } from "./use-autosave";

export function BrandBoilerplateForm({
  brandId,
  initial,
}: {
  brandId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const { state, errorMsg, forceSaveNow } = useAutoSave({
    value,
    save: async (v) => updateDefaultBoilerplate({ brandId, text: v }),
  });

  return (
    <Card
      title="Default boilerplate"
      indicator={
        <div className="flex items-center gap-2">
          <SaveIndicator state={state} errorMsg={errorMsg} />
          <button
            type="button"
            onClick={() => void forceSaveNow()}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            Save now
          </button>
        </div>
      }
    >
      <Field
        label="Boilerplate text"
        hint="The 'about' paragraph appended to every press release."
      >
        <textarea
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          placeholder="About Acme — Acme is a…"
        />
      </Field>
    </Card>
  );
}
