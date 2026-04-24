"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  connectIntegration,
  disconnectIntegration,
} from "@/lib/integrations/actions";

export type PartnerCard = {
  partner: "HUNTER" | "APOLLO" | "PODCHASER" | "SPARKTORO";
  label: string;
  supported: boolean;
  fieldCoverage: string[];
  costNote: string;
  existing: {
    id: string;
    maskedKey: string;
    status: string;
    lastSyncAt: Date | null;
    lastError: string | null;
  } | null;
};

export function PartnerCards({ cards }: { cards: PartnerCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((c) => (
        <Card key={c.partner} card={c} />
      ))}
    </div>
  );
}

function Card({ card }: { card: PartnerCard }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!card.existing);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("default");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    if (!apiKey.trim()) return;
    setError(null);
    start(async () => {
      const res = await connectIntegration({
        partner: card.partner,
        apiKey,
        label: label || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setApiKey("");
      setEditing(false);
      router.refresh();
    });
  }

  function disconnect() {
    if (!card.existing) return;
    if (!confirm(`Disconnect ${card.label}? This removes the stored API key.`)) return;
    start(async () => {
      await disconnectIntegration({ integrationId: card.existing!.id });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-brand-navy">{card.label}</h3>
          {card.existing ? (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  card.existing.status === "CONNECTED"
                    ? "bg-brand-pink/10 text-brand-pink"
                    : card.existing.status === "ERROR"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {card.existing.status}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {card.existing.maskedKey}
              </span>
            </div>
          ) : !card.supported ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Coming soon — ships in a later release.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not connected.</p>
          )}
        </div>
        {card.existing && card.existing.lastSyncAt && (
          <span className="text-[10px] text-muted-foreground">
            last sync {new Date(card.existing.lastSyncAt).toLocaleString()}
          </span>
        )}
      </div>

      {card.existing?.lastError && (
        <p className="mt-2 text-xs text-destructive">{card.existing.lastError}</p>
      )}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="font-semibold uppercase text-muted-foreground">
          Fills fields
        </p>
        <div className="flex flex-wrap gap-1">
          {card.fieldCoverage.map((f) => (
            <span
              key={f}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">{card.costNote}</p>

      {card.supported && (
        <div className="mt-4 space-y-2">
          {editing ? (
            <>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${card.label} API key`}
                className="w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs"
              />
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. 'default', 'client-A')"
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                {card.existing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setError(null);
                      setApiKey("");
                    }}
                    className="rounded-full border border-border px-3 py-1 text-xs"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={connect}
                  disabled={pending || !apiKey.trim()}
                  className="rounded-full bg-brand-pink px-3 py-1 text-xs text-white disabled:opacity-60"
                >
                  {pending ? "Checking…" : card.existing ? "Replace key" : "Connect"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand-pink"
              >
                Replace key
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
