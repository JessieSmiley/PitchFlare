"use client";

export type ContactDetail = {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: string;
  title: string | null;
  outletName: string | null;
  email: string | null;
  bio: string | null;
  beats: string[];
  fields: Array<{ key: string; value: string; source: string }>;
  recentWork: Array<{ title: string; url: string; source: string }>;
};

const SOURCE_LABEL: Record<string, string> = {
  AUTO_SCRAPED: "Auto-scraped",
  USER_ADDED: "You added",
  DATA_PARTNER: "Data partner",
};

const SOURCE_TONE: Record<string, string> = {
  AUTO_SCRAPED: "bg-muted text-muted-foreground",
  USER_ADDED: "bg-accent text-accent-foreground",
  DATA_PARTNER: "bg-brand-pink/10 text-brand-pink",
};

export function ContactDrawer({
  contact,
  onClose,
}: {
  contact: ContactDetail | null;
  onClose: () => void;
}) {
  if (!contact) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {contact.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {contact.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-display text-2xl text-brand-navy">
                {contact.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {contact.title ?? contact.kind}
                {contact.outletName && ` · ${contact.outletName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>

        {contact.bio && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Bio
            </h3>
            <p className="mt-1 text-sm text-brand-navy">{contact.bio}</p>
          </section>
        )}

        {contact.email && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Email
            </h3>
            <p className="mt-1 font-mono text-sm text-brand-navy">
              {contact.email}
            </p>
          </section>
        )}

        {contact.beats.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Beats
            </h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {contact.beats.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          </section>
        )}

        {contact.fields.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Fields
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {contact.fields.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="text-brand-navy">
                    <span className="text-muted-foreground">{f.key}:</span>{" "}
                    {f.value}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${SOURCE_TONE[f.source] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {SOURCE_LABEL[f.source] ?? f.source}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {contact.recentWork.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Recent work
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {contact.recentWork.map((rw) => (
                <li key={rw.url}>
                  <a
                    href={rw.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-pink hover:underline"
                  >
                    {rw.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-[10px] text-muted-foreground">
          AI pitch notes + &ldquo;Enrich with Hunter&rdquo; land in Chunk I
          (data partners).
        </p>
      </aside>
    </div>
  );
}
