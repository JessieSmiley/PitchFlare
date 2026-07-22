"use client";

import type { CompanySummary } from "@/lib/intelligence/types";

/**
 * Dedicated Company Intelligence panel — the full profile behind the
 * discovery snapshot: description, funding, executives, awards, podcast
 * mentions, recent press releases, and press/newsroom pages. All assembled
 * from free Tier-1 sources + AI extraction and served from the global cache.
 */
export function CompanyPanel({
  company,
  onClose,
}: {
  company: CompanySummary;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-pink">
              Company Intelligence
            </p>
            <h2 className="font-display text-2xl text-brand-navy">
              {company.name}
            </h2>
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-pink hover:underline"
              >
                {company.domain}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-2 py-1 text-xs"
          >
            Close
          </button>
        </header>

        <div className="flex flex-col gap-5 p-6 text-sm">
          {company.description && (
            <Section title="Overview">
              <p className="text-brand-navy">{company.description}</p>
            </Section>
          )}

          {(company.socials && Object.keys(company.socials).length > 0) ||
          company.linkedinUrl ? (
            <Section title="Social">
              <div className="flex flex-wrap gap-2">
                {company.linkedinUrl && (
                  <SocialLink label="linkedin" url={company.linkedinUrl} />
                )}
                {company.socials &&
                  Object.entries(company.socials)
                    .filter(([k]) => k !== "linkedin")
                    .map(([k, url]) => (
                      <SocialLink key={k} label={k} url={url} />
                    ))}
              </div>
            </Section>
          ) : null}

          {company.funding && company.funding.length > 0 && (
            <Section title="Funding">
              <ul className="space-y-1">
                {company.funding.map((f, i) => (
                  <li key={i} className="text-brand-navy">
                    {[f.round, f.amount, f.date].filter(Boolean).join(" · ") ||
                      "—"}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {company.executives && company.executives.length > 0 && (
            <Section title="Executives">
              <ul className="space-y-1">
                {company.executives.map((e, i) => (
                  <li key={i} className="text-brand-navy">
                    <span className="font-medium">{e.name}</span>
                    {e.title && (
                      <span className="text-muted-foreground"> · {e.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {company.awards && company.awards.length > 0 && (
            <Section title="Awards">
              <ul className="list-inside list-disc text-brand-navy">
                {company.awards.map((a, i) => (
                  <li key={i}>{a.title}</li>
                ))}
              </ul>
            </Section>
          )}

          {company.podcasts && company.podcasts.length > 0 && (
            <Section title="Podcast mentions">
              <ul className="list-inside list-disc text-brand-navy">
                {company.podcasts.map((p, i) => (
                  <li key={i}>{p.title}</li>
                ))}
              </ul>
            </Section>
          )}

          {company.pressReleases && company.pressReleases.length > 0 && (
            <Section title="Recent press">
              <ul className="space-y-1">
                {company.pressReleases.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-pink hover:underline"
                    >
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {company.pressPages && company.pressPages.length > 0 && (
            <Section title="Newsroom / press pages">
              <ul className="space-y-1">
                {company.pressPages.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-brand-pink hover:underline"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="text-[10px] text-muted-foreground">
            Assembled from free web sources (crawl, Schema.org, RSS, news) plus
            AI extraction, cached and shared. No paid enrichment credits spent.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SocialLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-full bg-muted px-3 py-1 text-xs text-brand-navy hover:bg-accent"
    >
      {label}
    </a>
  );
}
