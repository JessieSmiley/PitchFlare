"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact, importContactFromUrl } from "@/lib/contacts/actions";
import { Card, Field } from "@/components/brand/brand-basics-form";

type Kind = "JOURNALIST" | "PODCASTER" | "INFLUENCER" | "ANALYST" | "OUTLET";

export function AddContactForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Manual
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("JOURNALIST");
  const [email, setEmail] = useState("");
  const [outletName, setOutletName] = useState("");
  const [bio, setBio] = useState("");
  const [beatsCsv, setBeatsCsv] = useState("");

  // Import
  const [url, setUrl] = useState("");
  const [importKind, setImportKind] = useState<Kind>("JOURNALIST");

  function submitManual() {
    if (!name.trim()) return;
    setError(null);
    start(async () => {
      const res = await createContact({
        name,
        kind,
        email: email || undefined,
        outletName: outletName || undefined,
        bio: bio || undefined,
        beats: beatsCsv
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      setEmail("");
      setOutletName("");
      setBio("");
      setBeatsCsv("");
      router.refresh();
    });
  }

  function submitImport() {
    if (!url.trim()) return;
    setError(null);
    start(async () => {
      const res = await importContactFromUrl({ url, kind: importKind });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl("");
      router.refresh();
    });
  }

  return (
    <Card title="Add contact">
      <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 rounded-full px-3 py-1 ${
            mode === "manual" ? "bg-white font-medium text-brand-navy" : "text-muted-foreground"
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("import")}
          className={`flex-1 rounded-full px-3 py-1 ${
            mode === "import" ? "bg-white font-medium text-brand-navy" : "text-muted-foreground"
          }`}
        >
          Import from URL
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {mode === "manual" ? (
        <>
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Contact type" required>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="JOURNALIST">Journalist</option>
              <option value="PODCASTER">Podcaster</option>
              <option value="INFLUENCER">Influencer</option>
              <option value="ANALYST">Analyst</option>
              <option value="OUTLET">Outlet</option>
            </select>
          </Field>
          <Field label="Outlet">
            <input
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field
            label="Beats"
            hint="Comma-separated (e.g. saas, devtools, startups)"
          >
            <input
              value={beatsCsv}
              onChange={(e) => setBeatsCsv(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Bio">
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <button
            type="button"
            onClick={submitManual}
            disabled={busy || !name.trim()}
            className="w-full rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add contact"}
          </button>
        </>
      ) : (
        <>
          <Field
            label="Author / profile page URL"
            required
            hint="Paste a journalist's author page. We'll scrape name, outlet, bio, and recent work."
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://techpress.example/authors/alex-rivera"
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Contact type">
            <select
              value={importKind}
              onChange={(e) => setImportKind(e.target.value as Kind)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="JOURNALIST">Journalist</option>
              <option value="PODCASTER">Podcaster</option>
              <option value="INFLUENCER">Influencer</option>
              <option value="ANALYST">Analyst</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={submitImport}
            disabled={busy || !url.trim()}
            className="w-full rounded-full bg-brand-pink px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Scraping…" : "Import"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            Scraped fields are tagged with source &ldquo;Auto-scraped&rdquo; so you
            can tell them from fields you enter by hand.
          </p>
        </>
      )}
    </Card>
  );
}
