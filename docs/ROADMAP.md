# PitchFlare build roadmap

The backend is being built in sequential chunks. Each chunk ends with a
commit + push. Check `git log` on `claude/build-pitchflare-backend-*`
branches for the latest state.

| Chunk | Scope | Status |
| --- | --- | --- |
| **A** | Next.js 15 + Prisma + Clerk scaffold, dashboard shell, route stubs, README | shipped |
| **B** | `prisma/schema.prisma` (full SPEC.md data model) + seed script | shipped |
| **C** | Clerk middleware wiring, `AccountMembership` + `BrandMembership` provisioning, brand switcher, `assertCanCreateBrand` / `assertCanInviteUser` tier gates, Clerk webhook | shipped |
| **D** | Level-Set screens (brand profile, voice, boilerplate, pillars, spokespeople, prior examples), voice-from-website AI, `getBrandContextForAI(brandId)` helper with prompt caching | shipped |
| **E** | Ideation Station (streaming Claude, angle cards, remix, chat), Target Compilation (contact table, profile drawer, match-scoring, "+ Add contact", "Import from URL" scraper) | shipped (chat + streaming deferred) |
| **F** | Pitch composer (single + batch + A/B variants), press releases, social posts, follow-ups. Execute/email: mailbox OAuth (Gmail/Outlook), Resend fallback, send queue, throttle, open/click tracking endpoints, follow-up scheduler | shipped (Pitches + Execute-email; Press Releases / Social / Follow-ups / Mailbox OAuth deferred) |
| **G** | Coverage monitoring cron (Google News RSS + GDELT + Bing News), sentiment via Claude, the three on-demand generators (Status Report, Media Brief, Talking Points) with `@react-pdf/renderer` branded exports | shipped (Google News RSS source; GDELT + Bing News + PostHog-ish SoV deferred) |
| **H** | Stripe products + prices, Checkout, Customer Portal, `/api/webhooks/stripe`, tier-limit enforcement wired to real subscription state | shipped |
| **I** | `DataPartner` provider interface + modules: Hunter.io (first), Apollo, Podchaser, SparkToro. AES-256-GCM crypto helper for partner API keys. Enrichment merge respecting source provenance. | shipped (Hunter live; Apollo / Podchaser / SparkToro stubbed behind the same interface) |
| **I.2** | Contact **discovery** on the same provider interface (`discover()` / `supportsDiscovery`): the Targets search bar can pull in *new* contacts, not just filter loaded ones. Candidates persist with email dedup. | shipped (Hunter `domain-search` live; Apollo people-search is the next `discover()` implementation behind the same interface) |
| **I.3** | **Tiered, cache-first intelligence architecture** (`lib/intelligence/`). Three services — Media, Company, Contact — with only Contact spending paid credits. Waterfall per search: own DB → global/per-account cache → free Tier-1 sources (crawl + Schema.org + RSS bylines + Google News + LinkedIn company URL) → email permutation + MX/syntax/role heuristic verify → paid providers (Hunter live; Apollo/Prospeo/Dropcontact/PDL stubbed) → cache. Public company/media cached globally (cross-tenant); paid contact data cached per-account (BYO-credit isolation). | shipped |
| **I.4** | **Claude fact-extraction for Company Intelligence** (Haiku): pulls funding, awards, podcast mentions, and a cleaned executive list out of crawled homepage prose + headlines, merged over the free Schema.org signals and persisted on `CompanyProfile` (extracted once per company per refresh, token usage logged). Company snapshot surfaced in the discovery panel header. | shipped |
| **I.5** | **Prospeo** — second live paid email resolver (`enrich-person`) behind the shared `DataProvider` interface + BYO connect card in Settings. Contact Intelligence waterfall now falls through Hunter → Prospeo (cheapest-first, stops at first hit) before giving up. | shipped |
| **I.6** | **Company Intelligence panel** — full company profile drawer (overview, socials, funding, executives, awards, podcast mentions, recent press, newsroom pages) opened from the discovery panel; all free-sourced + cached. | shipped |
| **J** | Error boundaries, loading + empty states, keyboard shortcuts, a11y pass, `/help`, Sentry, PostHog, Vercel deploy, production smoke test | shipped |

## Out of scope for v1

See SPEC.md §7. Summary: no native mobile, no podcast transcription, no
TV/broadcast monitoring, no crisis war-room, no white-label.
