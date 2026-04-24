"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Command = {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
};

/**
 * Global keyboard shortcuts + command palette.
 *   ⌘K / Ctrl+K  — toggle palette (fuzzy jumps to any phase screen)
 *   ⌘/ / Ctrl+/  — help
 *   ⌘N / Ctrl+N  — new pitch
 * We handle Meta (macOS) and Control (everywhere else) so parity is
 * intuitive without a platform fork.
 *
 * The palette is a controlled Radix-free dialog — we ship the minimum
 * needed here to avoid bringing in a new dep. Focus lands on the input
 * on open; Escape + click-outside close it.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const commands: Command[] = useMemo(
    () => [
      { id: "home", label: "Dashboard home", hint: "home", action: () => router.push("/dashboard") },
      { id: "level-set", label: "Level-Set", hint: "brand profile", action: () => router.push("/dashboard/level-set") },
      { id: "ideation", label: "Ideation Station", hint: "angles", action: () => router.push("/dashboard/strategize/ideation") },
      { id: "targets", label: "Target Compilation", hint: "contacts", action: () => router.push("/dashboard/strategize/targets") },
      { id: "pitches", label: "Pitches", hint: "draft", action: () => router.push("/dashboard/draft/pitches") },
      { id: "execute", label: "Execute · Direct Email", hint: "send", action: () => router.push("/dashboard/execute/email") },
      { id: "analyze", label: "Analyze", hint: "coverage", action: () => router.push("/dashboard/analyze") },
      { id: "report", label: "Report", hint: "pdf exports", action: () => router.push("/dashboard/report") },
      { id: "billing", label: "Billing", hint: "plan + usage", action: () => router.push("/dashboard/settings/billing") },
      { id: "integrations", label: "Integrations", hint: "Hunter et al.", action: () => router.push("/dashboard/settings/integrations") },
      { id: "help", label: "Help", action: () => router.push("/dashboard/help") },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.hint ?? "").toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;

      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        router.push("/dashboard/help");
        return;
      }
      if (e.key.toLowerCase() === "n" && !inField) {
        // Browsers reserve Cmd+N for new window. We use Cmd+Shift+N for
        // "new pitch" to avoid fighting the platform.
        if (!e.shiftKey) return;
        e.preventDefault();
        router.push("/dashboard/draft/pitches");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to…"
          className="w-full rounded-t-lg border-b border-border bg-white px-4 py-3 text-sm outline-none"
          aria-label="Search commands"
        />
        <ul className="max-h-[360px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-xs text-muted-foreground">
              No matches.
            </li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    c.action();
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="text-brand-navy">{c.label}</span>
                  {c.hint && (
                    <span className="text-[10px] text-muted-foreground">
                      {c.hint}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>⌘K · palette</span>
          <span>⌘/ · help</span>
          <span>⌘⇧N · new pitch</span>
        </div>
      </div>
    </div>
  );
}
