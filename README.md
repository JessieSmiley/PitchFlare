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

## License

Proprietary. © PitchFlare.
