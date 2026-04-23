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
| **E** | Ideation Station (streaming Claude, angle cards, remix, chat), Target Compilation (contact table, profile drawer, match-scoring, "+ Add contact", "Import from URL" scraper) | pending |
| **F** | Pitch composer (single + batch + A/B variants), press releases, social posts, follow-ups. Execute/email: mailbox OAuth (Gmail/Outlook), Resend fallback, send queue, throttle, open/click tracking endpoints, follow-up scheduler | pending |
| **G** | Coverage monitoring cron (Google News RSS + GDELT + Bing News), sentiment via Claude, the three on-demand generators (Status Report, Media Brief, Talking Points) with `@react-pdf/renderer` branded exports | pending |
| **H** | Stripe products + prices, Checkout, Customer Portal, `/api/webhooks/stripe`, tier-limit enforcement wired to real subscription state | pending |
| **I** | `DataPartner` provider interface + modules: Hunter.io (first), Apollo, Podchaser, SparkToro. AES-256-GCM crypto helper for partner API keys. Enrichment merge respecting source provenance. | pending |
| **J** | Error boundaries, loading + empty states, keyboard shortcuts, a11y pass, `/help`, Sentry, PostHog, Vercel deploy, production smoke test | pending |

## Out of scope for v1

See SPEC.md §7. Summary: no native mobile, no podcast transcription, no
TV/broadcast monitoring, no crisis war-room, no white-label.
