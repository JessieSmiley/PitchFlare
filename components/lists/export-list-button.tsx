"use client";

import { useState, useTransition } from "react";
import { exportListCsv } from "@/lib/contacts/list-actions";

/** Downloads the list as a CSV built server-side (details + likelihood). */
export function ExportListButton({
  listId,
  disabled,
}: {
  listId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exportCsv() {
    setError(null);
    start(async () => {
      const res = await exportListCsv({ mediaListId: listId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={exportCsv}
        disabled={pending || disabled}
        className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink disabled:opacity-60"
      >
        {pending ? "Exporting…" : "Export CSV"}
      </button>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </div>
  );
}
