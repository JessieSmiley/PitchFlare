# PitchFlare — Product & Technical Specification

> AI-native PR and media intelligence platform for freelance PR consultants and boutique/agency teams.

---

## 1. Product Overview

PitchFlare helps PR professionals run end-to-end campaigns through six guided phases, from brand setup through ROI reporting. It combines an AI pitch strategy engine, multi-channel contact intelligence (journalists, podcasters, influencers), campaign execution (email + wire), and coverage analytics in a single workspace.

### Target users
- Freelance PR consultants (Solo)
- Boutique PR shops (Boutique)
- Small-to-mid PR agencies (Agency)

### Core differentiators
1. **AI pitch strategy engine** — produces actual angles, hooks, and positioning (not fill-in-the-blank templates).
2. **Multi-channel contact lists** — journalists, podcasters, and influencers as first-class entities, not just press contacts.
3. **Full campaign workflow** — one tool from strategy to ROI report; no bolt-on monitoring/reporting suites.
4. **Transparent BYO-account data partners** — Hunter.io, Apollo, Podchaser, SparkToro integrations use the user's own credentials for sourcing/enrichment; no opaque reseller markup.

---

## 2. Plans & Multi-Tenancy Model

| Plan | Price | Seats | Brands |
|---|---|---|---|
| **Solo** | $99/mo | 1 | 1 |
| **Boutique** | $249/mo | 1 seat / 3 brands **OR** 3 seats / 1 brand | see seats |
| **Agency** | $499/mo | 5 | 10 |

### Tenancy hierarchy
```
Account (billing entity, one plan)
├── Users (seats, joined via AccountMembership with roles)
└── Brands (isolated workspaces — own voice, campaigns, contacts, reports)
    └── Campaigns
        └── Pitches / PressReleases / SocialPosts / Coverage / Reports
```

- An **Account** is the billing tenant. It holds a plan, seat count, and brand count limits.
- A **User** can belong to multiple Accounts via `AccountMembership` with a role (`OWNER | ADMIN | MEMBER`).
- A **Brand** is a workspace inside an Account. All campaign data is scoped to a Brand. Users see only the Brands they're assigned to within an Account.
- Boutique's "1 seat / 3 brands OR 3 seats / 1 brand" is enforced as `(seats_used * brands_used) <= 3` with both dimensions capped at 3.

---

## 3. The Six Phases

Every Campaign moves through these phases. Phases are non-blocking (users can jump around), but the UI surfaces the "current" phase and gates AI suggestions to phase context.

### Phase 1 — Level-Set (Brand Setup)
Establish the brand's identity so every downstream AI output is grounded.
- Brand profile: name, description, category, website
- **Voice profile**: tone attributes, banned words, writing samples (AI analyzes samples to lock voice)
- Boilerplate (the "about" paragraph appended to releases)
- Key messaging pillars and talking points
- Executives / spokespeople with bios
- Product/service one-pagers
- Competitor list (used later for Share-of-Voice)
- Brand assets (logos, headshots, product images)

### Phase 2 — Strategize
Turn brand + news moment into a concrete campaign plan.
- **Ideation Station** — AI angle generator: user enters a news hook, product launch, or trend; Claude returns a ranked set of story angles with audience fit, newsworthiness score, and suggested outlet tiers.
- **Campaign brief** — title, objective, KPIs, timeline, embargo/launch date.
- **Target list building** — AI suggests journalists/podcasters/influencers per angle from the Contacts DB, filterable by beat, outlet tier, recent coverage, and channel type. Saved as a `MediaList`.
- **Pitch strategy document** — AI-composed positioning memo: the narrative, the angle hierarchy, the contact tiering, the sequencing.

### Phase 3 — Draft
Produce every asset the campaign needs.
- **Pitches** — personalized per-contact or per-segment; Claude uses brand voice + angle + contact history.
- **Press releases** — headline/subhead/body/boilerplate; AP-style checks.
- **Social posts** — per-platform (X, LinkedIn, Instagram, Threads); length/format appropriate.
- **Follow-up sequences** — 1st, 2nd, 3rd touch drafts with escalating hooks.
- **Version history** — every AI revision saved; diffable.
- **Approval workflow** — for multi-seat plans, drafts can require approval before execution.

### Phase 4 — Execute
Actually send the campaign.
- **Email distribution** — sends pitches/follow-ups to contacts with tracking (opens, clicks, replies).
- **Wire distribution (v1: manual export only)** — PitchFlare generates a formatted press release + distribution kit (headline, dateline, body, boilerplate, contact block, media assets in a zip) that the user uploads to their chosen wire service (PR Newswire / Business Wire / EIN / GlobeNewswire). Partner API integrations are deferred to v1.1 based on which services actual users pick.
- **Social publishing** — scheduled publishing or export to user's scheduling tool.
- **Sequence engine** — drips follow-ups based on open/reply state; pauses sequence on reply.

### Phase 5 — Analyze
Capture what happened in the media.
- **Real-time monitoring** — keyword/brand/competitor queries against news + podcast + social sources.
- **Coverage clips** — triaged mentions with url, outlet, author, published date, reach/AVE estimate.
- **Sentiment analysis** — Claude-scored per-clip (positive/neutral/negative + confidence).
- **Media intelligence** — trending outlets, rising journalists, topic clustering, competitor coverage.
- **Share of Voice** — brand vs. competitors over time and by topic.

### Phase 6 — Report
Prove the work.
- **Coverage reports** — shareable HTML/PDF reports with filter-pinned clips, sentiment, reach, SoV, quotes used.
- **ROI report** — estimated impressions, AVE, quality-weighted score, goal attainment vs. KPIs set in Strategize.
- **On-demand status brief** — user asks "what's happened on Campaign X this week?" and Claude generates a fresh narrative summary from coverage + send data.
- **Scheduled digests** — weekly/monthly auto-generated reports emailed to client stakeholders.

---

## 4. Tech Stack

### Confirmed defaults
| Layer | Choice | Reasoning |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Best-in-class Vercel fit; RSC cuts client JS for data-heavy tables. |
| Language | **TypeScript** (strict) | Non-negotiable for a data model this large. |
| UI | **shadcn/ui + Tailwind CSS** | Owned components, fast iteration, no vendor lock-in. |
| ORM | **Prisma** | Type-safe queries; migrations; introspection. |
| Database | **Postgres via Neon** | Serverless; branch-per-preview fits Vercel; cheaper than Supabase when you don't need their auth/storage layer (we're using Clerk). |
| Auth | **Clerk** | Organizations map cleanly to our Account tenant; handles SSO/MFA; React components save weeks. |
| AI | **Anthropic SDK** | Claude Sonnet 4.6 as default; Opus 4.7 for deep strategy (Ideation Station, status briefs); Haiku 4.5 for quick transforms (tone tweaks, subject lines). |

### Additional stack pieces (proposed)
| Concern | Choice | Reasoning |
|---|---|---|
| Background jobs | **Inngest** | Durable execution, retries, fan-out — essential for send sequences, monitoring polls, report generation. First-class Vercel DX. |
| Transactional email (app) | **Resend** + React Email | For app emails (invites, digests, notifications). |
| Campaign email sending | **User OAuth (Gmail + Outlook) primary, Resend fallback** | Each user connects their own inbox via OAuth; pitches send from their real address so journalists see a human sender and replies sync into PitchFlare. Resend is used as a fallback when no inbox is connected (e.g. scheduled follow-ups after a user revokes access) and for automated sequence touches the user opts to send from a verified brand domain. |
| File storage | **Vercel Blob** | Simplest for logos, clip PDFs, brand assets; swap to S3 later if needed. |
| Billing | **Stripe** (Billing + Customer Portal) | Stripe Checkout for subscribe; Portal for plan changes/cancellation. |
| Error tracking | **Sentry** | Standard. |
| Product analytics | **PostHog** | Self-hostable later; session replay helpful in beta. |
| News monitoring (v1) | **GDELT + Google News RSS + Bing News API** | Free/low-cost stack to ship. Trade-off: no paywalled outlets and limited social coverage. Data-source layer abstracted behind a `MonitoringProvider` interface so a paid partner (NewsWhip/Meltwater) can be swapped in per-plan later without touching downstream Mention/CoverageClip logic. |
| Podcast monitoring | **Podchaser** (BYO-account) | Aligns with BYO partner model. |
| Social monitoring | **SparkToro + X/LinkedIn public APIs** | BYO-account for SparkToro. |
| Contact enrichment | **Hunter.io, Apollo** (BYO-account) | Aligns with BYO partner model. |
| Testing | **Vitest** + **Playwright** | Unit + E2E. |
| Deployment | **Vercel** | Confirmed. |

### AI model routing (Claude)
- **Opus 4.7** — `claude-opus-4-7` — Ideation Station angle generation, pitch strategy memo, on-demand status briefs, sentiment rationale.
- **Sonnet 4.6** — `claude-sonnet-4-6` — Default for pitch/release/social drafting, voice analysis, coverage triage.
- **Haiku 4.5** — `claude-haiku-4-5-20251001` — Subject line variants, tone tweaks, short rewrites, enrichment normalization.

Prompt caching will be used aggressively for Brand Voice / boilerplate / campaign context that repeats across many calls.

---

## 5. High-Level Data Model

Table names and key relationships only — columns filled in during implementation.

### Identity & tenancy
- **Account** — tenant; `plan`, `stripe_customer_id`, `seat_limit`, `brand_limit`
- **User** — mirror of Clerk user; `clerk_user_id`, `email`, `name`
- **AccountMembership** — `account_id` × `user_id`, `role` (OWNER/ADMIN/MEMBER)
- **Subscription** — `account_id`, Stripe subscription state
- **Integration** — `account_id`, `partner` (HUNTER/APOLLO/PODCHASER/SPARKTORO/WIRE/...), encrypted credentials, status

### Brand workspace
- **Brand** — `account_id`, name, description, website, category
- **BrandVoice** — `brand_id`, tone attributes, banned words, style notes, sample corpus
- **BrandBoilerplate** — `brand_id`, text, is_default
- **MessagingPillar** — `brand_id`, title, description, talking_points[]
- **Spokesperson** — `brand_id`, name, title, bio, headshot_url
- **Product** — `brand_id`, name, description, one-pager url
- **Competitor** — `brand_id`, name, domain (for SoV)
- **BrandAsset** — `brand_id`, kind (LOGO/HEADSHOT/IMAGE/DOC), storage_url
- **BrandMembership** — `brand_id` × `user_id` (scopes Boutique/Agency seats to specific brands)

### Campaign core
- **Campaign** — `brand_id`, title, objective, phase (LEVEL_SET/STRATEGIZE/DRAFT/EXECUTE/ANALYZE/REPORT), status, launch_date, embargo_date
- **CampaignKPI** — `campaign_id`, metric, target, actual
- **Angle** — `campaign_id`, title, narrative, newsworthiness_score, audience_fit, source ("ideation_station" | "manual")
- **PitchStrategy** — `campaign_id`, narrative_memo, tiering, sequencing (AI-generated doc)

### Contacts & media
- **Contact** — `name`, `email`, `bio`, `kind` (JOURNALIST/PODCASTER/INFLUENCER/ANALYST)
- **Outlet** — `name`, `domain`, `kind` (PUBLICATION/PODCAST/YOUTUBE/NEWSLETTER/SOCIAL), tier
- **ContactOutlet** — `contact_id` × `outlet_id`, role/title, is_primary
- **Beat** — `name` (topic tag)
- **ContactBeat** — `contact_id` × `beat_id`
- **ContactInteraction** — history of pitches sent / replies / coverage authored (per brand)
- **MediaList** — `brand_id`, `campaign_id?`, name, description
- **MediaListMember** — `media_list_id` × `contact_id`, tier, notes

Contacts and outlets are *shared across the platform* (a global directory), but `ContactInteraction` is brand-scoped so one brand's history doesn't leak to another.

### Content artifacts
- **Pitch** — `campaign_id`, `angle_id?`, `contact_id?` (null = template), subject, body, status (DRAFT/APPROVED/SCHEDULED/SENT)
- **PressRelease** — `campaign_id`, headline, subhead, body, boilerplate_id, dateline, status
- **SocialPost** — `campaign_id`, platform (X/LINKEDIN/INSTAGRAM/THREADS), body, media_urls[], status
- **FollowUp** — `pitch_id`, sequence_step, delay_days, subject, body
- **ContentVersion** — polymorphic revision history (`entity_type`, `entity_id`, `version_n`, `content_snapshot`, `ai_prompt_used`)
- **Approval** — `entity_type`, `entity_id`, `requested_by`, `approver_id`, `status`

### Execution
- **MailboxConnection** — `user_id`, provider (GMAIL/OUTLOOK), oauth tokens (encrypted), scopes, sync_cursor, status
- **EmailThread** — `brand_id`, provider, external_thread_id (from Gmail/Outlook or Resend inbound-parse)
- **EmailSend** — `pitch_id` or `followup_id`, `contact_id`, `thread_id`, `message_id`, `send_path` (OAUTH_MAILBOX/RESEND), sent_at
- **EmailEvent** — `email_send_id`, type (DELIVERED/OPENED/CLICKED/REPLIED/BOUNCED/UNSUBSCRIBED), occurred_at, metadata
- **Sequence** — `campaign_id`, name, rules
- **SequenceStep** — `sequence_id`, step_n, delay_days, content_ref
- **WireExport** — `press_release_id`, kit_storage_url, generated_at, target_partner_hint (user's chosen wire, for v1.1 migration to real integrations)

### Analysis
- **MonitoringQuery** — `brand_id`, `campaign_id?`, keywords[], sources[], competitors[]
- **Mention** — raw hit from a monitoring source (url, outlet, title, excerpt, published_at, source_provider)
- **CoverageClip** — promoted Mention tied to brand/campaign; author `contact_id?`, `outlet_id?`, reach_estimate, ave_estimate, sentiment_score, sentiment_label, sov_weight, quote_used?
- **SentimentAnalysis** — `clip_id`, score (-1..1), label, confidence, rationale (Claude-generated)

### Reporting
- **Report** — `brand_id`, `campaign_id?`, type (COVERAGE/ROI/SOV/STATUS_BRIEF), generated_at, payload_json, shareable_url, expiry
- **ReportSchedule** — `brand_id`, type, cadence (WEEKLY/MONTHLY), recipients[]

### Auditing & meta
- **AuditLog** — `account_id`, `user_id`, action, entity, before/after
- **AIUsageLog** — `account_id`, `brand_id`, model, input_tokens, output_tokens, cost, feature

---

## 6. Deployment & Environments

- **Vercel** (production + preview deploys from every PR)
- **Neon** branch databases per preview deploy
- **Inngest** cloud for background jobs
- Environments: `development` (local), `preview` (per-branch), `production`
- Secrets managed via Vercel + `.env.local` for dev

---

## 7. Out of Scope for v1

- Native mobile apps (responsive web only)
- Podcast audio transcription (use Podchaser summaries initially)
- TV/broadcast monitoring
- Crisis-comms war-room features
- White-label / reseller mode
