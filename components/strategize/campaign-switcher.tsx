"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export type CampaignOption = {
  id: string;
  title: string;
};

export function CampaignSwitcher({
  current,
  options,
  basePath,
}: {
  current: CampaignOption | null;
  options: CampaignOption[];
  /** Route to redirect to when switching, e.g. /dashboard/strategize/ideation */
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) {
      router.replace(basePath);
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.set("campaignId", id);
    router.replace(`${basePath}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Campaign
        <select
          value={current?.id ?? ""}
          onChange={onChange}
          className="rounded-md border border-border bg-white px-2 py-1 text-xs text-brand-navy"
        >
          <option value="">— new campaign —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <Link
          href={`/dashboard/strategize/targets?campaignId=${current.id}`}
          className="text-xs text-brand-pink hover:underline"
        >
          → Targets
        </Link>
      )}
    </div>
  );
}
