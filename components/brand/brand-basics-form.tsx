"use client";

import { useState } from "react";
import { updateBrandBasics } from "@/lib/brand/actions";
import { SaveIndicator, useAutoSave } from "./use-autosave";

type Basics = {
  name: string;
  description: string;
  website: string;
  category: string;
  logoUrl: string;
};

export function BrandBasicsForm({
  brandId,
  initial,
}: {
  brandId: string;
  initial: Basics;
}) {
  const [value, setValue] = useState<Basics>(initial);
  const { state, errorMsg } = useAutoSave({
    value,
    skip: (v) => v.name.trim().length === 0,
    save: async (v) =>
      updateBrandBasics({
        brandId,
        name: v.name,
        description: v.description || null,
        website: v.website || null,
        category: v.category || null,
        logoUrl: v.logoUrl || null,
      }),
  });

  return (
    <Card title="Brand basics" indicator={<SaveIndicator state={state} errorMsg={errorMsg} />}>
      <Field label="Brand name" required>
        <input
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={value.description}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website">
          <input
            type="url"
            value={value.website}
            onChange={(e) => setValue({ ...value, website: e.target.value })}
            placeholder="https://acme.com"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category">
          <input
            value={value.category}
            onChange={(e) => setValue({ ...value, category: e.target.value })}
            placeholder="SaaS, Consumer, Healthcare…"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label="Logo URL">
        <input
          type="url"
          value={value.logoUrl}
          onChange={(e) => setValue({ ...value, logoUrl: e.target.value })}
          placeholder="https://acme.com/logo.svg"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>
    </Card>
  );
}

export function Card({
  title,
  indicator,
  children,
}: {
  title: string;
  indicator?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-brand-navy">{title}</h2>
        {indicator}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-brand-navy">
        {label}
        {required && <span className="text-brand-pink"> *</span>}
      </span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
