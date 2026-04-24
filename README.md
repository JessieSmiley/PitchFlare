# PitchFlare

AI-native PR and media intelligence for freelance consultants and boutique
agencies. See [`SPEC.md`](./SPEC.md) for the full product + technical
specification.

## Status

Early scaffold. This commit lands the Next.js 15 + Prisma + Clerk shell plus
the Prisma schema. The six-phase app screens are stubbed pages that point at
the chunk where they'll be implemented. Roadmap in [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma +
Postgres (Neon) · Clerk (auth + organizations) · Anthropic SDK · Stripe
· Resend · Inngest · Vercel. Full reasoning in SPEC.md §4.

## Local setup

### 1. Prerequisites

- Node 20+ (this repo is developed on 22) — `node --version`
- pnpm (or npm) — `pnpm --version`
- A Postgres database. **Neon is recommended** because its branching model
  pairs with Vercel preview deploys.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create a database

1. Go to [neon.tech](https://neon.tech) → create a free project named `pitchflare`.
2. Copy the **pooled** connection string (ends in `-pooler...`). This is `DATABASE_URL`.
3. Copy the **direct** connection string (no `-pooler`). This is `DIRECT_URL` — used by Prisma migrations.

### 4. Create a Clerk project

1. Go to [clerk.com](https://clerk.com) → create an application.
2. Enable **Organizations** under Organization Settings (required for multi-tenancy; Accounts map 1:1 to Clerk orgs).
3. Copy the Publishable Key and Secret Key from the API Keys page.
4. Create a webhook endpoint at `${APP_URL}/api/webhooks/clerk` subscribed to
   `user.created`, `user.updated`, `organization.created`,
   `organizationMembership.created`, `organizationMembership.deleted`. Copy
   the signing secret — this is `CLERK_WEBHOOK_SECRET`.

### 5. Get your Anthropic key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.
2. Copy into `ANTHROPIC_API_KEY`.

### 6. Generate an encryption key

Data-partner API keys (Hunter, Apollo, Podchaser, SparkToro) are stored
AES-256-GCM encrypted at rest. Generate a 32-byte key:

```bash
openssl rand -base64 32
```

Paste into `PF_ENCRYPTION_KEY`. **Never rotate this without a migration
strategy** — existing ciphertexts become unreadable.

### 7. Configure `.env.local`

```bash
cp .env.example .env.local
```

Paste every value you collected above. Stripe/Resend/Inngest keys can be
placeholders for now; they're only read when you run those features. The
only keys required to boot the app are `DATABASE_URL`, `DIRECT_URL`, the
three Clerk keys, and `ANTHROPIC_API_KEY`.

### 8. Run migrations + seed

```bash
pnpm db:migrate        # creates the schema on your Neon database
pnpm db:seed           # optional: inserts a demo Account / Brand / Campaign / 3 Contacts
```

### 9. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for a new account;
the Clerk webhook provisions your Account row on sign-up (wired in Chunk C).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | `prisma generate` + production build |
| `pnpm start` | Run the built app |
| `pnpm lint` | Next.js ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Create + apply a dev migration |
| `pnpm db:deploy` | Apply migrations (production) |
| `pnpm db:push` | Prototype schema changes without a migration file |
| `pnpm db:studio` | Open Prisma Studio to browse data |
| `pnpm db:seed` | Seed demo data |
| `pnpm stripe:setup` | Provision Stripe products + prices (idempotent) |
| `pnpm test` | Run Vitest once |

## Repo layout

```
app/
  (auth)/              Clerk sign-in / sign-up
  (dashboard)/         Authenticated app shell + six-phase screens
  api/                 Route handlers (tracking, webhooks, AI streams)
components/            Shared UI (shadcn lives under components/ui in later chunks)
lib/                   db, env, auth helpers, AI clients, providers, crypto
prisma/                schema.prisma + seed.ts
docs/                  ROADMAP.md and architecture notes
```

## Deploying to Vercel

1. **Push the repo to GitHub** (if not already).
2. **New project** on [vercel.com](https://vercel.com) → import from the repo. Framework preset: Next.js. Install command: `pnpm install`.
3. **Environment variables** — paste every value from `.env.example` into the Vercel project settings. Mirror them into Preview + Production environments (most overlap; `NEXT_PUBLIC_APP_URL` will differ).
4. **Connect your Neon branch** via the Vercel ↔ Neon integration, or paste `DATABASE_URL` + `DIRECT_URL` manually.
5. **Configure Stripe webhook:** point a new endpoint at `https://<your-domain>/api/webhooks/stripe` subscribed to `checkout.session.completed`, `customer.subscription.*`, and `invoice.payment_failed`. Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. **Configure Clerk webhook:** `https://<your-domain>/api/webhooks/clerk` subscribed to `user.*`, `organization.*`, `organizationMembership.*`. Paste the signing secret into `CLERK_WEBHOOK_SECRET`.
7. **Cron:** `vercel.json` already registers `/api/cron/monitor` every 6 hours. Vercel calls it with `Authorization: Bearer $CRON_SECRET` — set `CRON_SECRET` in the project env.
8. **Deploy.** The build runs `prisma generate && next build`. Migrations run separately: `pnpm db:deploy` against production `DIRECT_URL` from your machine or from CI before you promote.
9. **Smoke test production** in order:
   - Sign up → Clerk org is auto-created → Account row appears (check Neon / Prisma Studio).
   - Create a brand → Level-Set fields auto-save → completeness meter moves.
   - Run Strategize → Ideation returns 5 angles → pick a primary.
   - Import a contact from a real journalist's URL → open the drawer → fields show with the `Auto-scraped` badge.
   - Connect Hunter on `/dashboard/settings/integrations` → Enrich the contact → fields appear with `Data partner` badge.
   - Draft a pitch → Approve → send from Execute (use a Resend sandbox domain or your own verified sender).
   - Confirm open tracking by opening the email in a real inbox → `openedAt` stamps on the EmailSend row.
   - Manually add a coverage URL on Analyze → sentiment appears.
   - Generate a Status Report → download the PDF.
   - Upgrade via Stripe (test mode) → Account.plan flips and seat/brand limits adjust.

## Repo layout

```
app/
  (auth)/              Clerk sign-in / sign-up
  (dashboard)/         Authenticated app shell + six-phase screens + help + error/loading
  api/
    cron/              Vercel Cron entrypoints
    reports/           PDF download route
    track/             Open + click tracking pixels
    webhooks/          Clerk + Stripe signature-verified handlers
  onboarding/          Create-org + first-brand flow
components/
  analyze/ brand/ billing/ draft/ execute/ help/ integrations/
  report/ shortcuts/ strategize/ targets/ analytics/
lib/
  ai/ auth/ billing/ brand/ campaigns/ contacts/ email/
  integrations/ monitoring/ pitches/ providers/ reports/
  crypto.ts  db.ts  env.ts  plans.ts  utils.ts
prisma/                schema.prisma + seed.ts
scripts/               setup-stripe-products.ts
docs/                  ROADMAP.md
instrumentation.ts     Sentry request hook (no-op if @sentry/nextjs isn't installed)
vercel.json            Cron schedule + per-route maxDuration
```

## License

Proprietary. © PitchFlare.
