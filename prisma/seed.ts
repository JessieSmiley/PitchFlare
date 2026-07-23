/**
 * Seed script — creates one demo Account, User, Brand, Campaign, and three
 * sample Contacts so local development has realistic data to work against.
 *
 * Safe to re-run: all upserts key off stable slugs / emails.
 *
 * Run with: `pnpm db:seed`
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // ---------- Account ----------
  const account = await db.account.upsert({
    where: { clerkOrgId: "org_demo" },
    update: {},
    create: {
      clerkOrgId: "org_demo",
      name: "Demo Agency",
      plan: "SOLO",
      seatLimit: 1,
      brandLimit: 1,
    },
  });

  // ---------- User ----------
  const user = await db.user.upsert({
    where: { email: "demo@pitchflare.test" },
    update: {},
    create: {
      clerkUserId: "user_demo",
      email: "demo@pitchflare.test",
      name: "Demo User",
    },
  });

  await db.accountMembership.upsert({
    where: { accountId_userId: { accountId: account.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { accountId: account.id, userId: user.id, role: "OWNER" },
  });

  // ---------- Brand ----------
  const brand = await db.brand.upsert({
    where: { accountId_slug: { accountId: account.id, slug: "demo-brand" } },
    update: {},
    create: {
      accountId: account.id,
      slug: "demo-brand",
      name: "Demo Brand",
      description: "A fictional SaaS for seeding local data.",
      website: "https://example.com",
      category: "SaaS",
    },
  });

  await db.brandMembership.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    update: {},
    create: { brandId: brand.id, userId: user.id },
  });

  await db.brandVoice.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      toneAttributes: ["confident", "direct", "warm"],
      bannedWords: ["revolutionary", "disruptive", "synergy"],
      alwaysDo: "Lead with customer outcomes.",
      neverDo: "Use jargon without defining it.",
      styleNotes: "Short sentences. Concrete examples. Minimal adverbs.",
    },
  });

  // ---------- Campaign ----------
  const campaign = await db.campaign.upsert({
    where: { id: "seed_campaign_1" },
    update: {},
    create: {
      id: "seed_campaign_1",
      brandId: brand.id,
      title: "Q2 Product Launch",
      objective: "Drive awareness and trial signups for v2.0.",
      goalType: "LAUNCH",
      toneTags: ["confident", "urgent"],
      budgetRange: "$5k-$25k",
      marketSentimentNotes:
        "Category is crowded; differentiate on speed + pricing.",
      phase: "STRATEGIZE",
      status: "ACTIVE",
    },
  });

  // ---------- Contacts ----------
  const [journalist, podcaster, influencer] = await Promise.all([
    db.contact.upsert({
      where: { id: "seed_contact_journalist" },
      update: {},
      create: {
        id: "seed_contact_journalist",
        kind: "JOURNALIST",
        name: "Alex Rivera",
        email: "alex@techpress.example",
        bio: "Senior writer covering SaaS and developer tools.",
      },
    }),
    db.contact.upsert({
      where: { id: "seed_contact_podcaster" },
      update: {},
      create: {
        id: "seed_contact_podcaster",
        kind: "PODCASTER",
        name: "Jordan Nkomo",
        email: "jordan@buildshow.example",
        bio: "Host of The Build Show, 40k weekly listeners.",
      },
    }),
    db.contact.upsert({
      where: { id: "seed_contact_influencer" },
      update: {},
      create: {
        id: "seed_contact_influencer",
        kind: "INFLUENCER",
        name: "Priya Shah",
        email: "priya@creator.example",
        bio: "B2B SaaS creator on LinkedIn + X, 80k followers combined.",
      },
    }),
  ]);

  // Beats
  const [saasBeat, devtoolsBeat, startupsBeat] = await Promise.all([
    db.beat.upsert({ where: { name: "saas" }, update: {}, create: { name: "saas" } }),
    db.beat.upsert({ where: { name: "devtools" }, update: {}, create: { name: "devtools" } }),
    db.beat.upsert({ where: { name: "startups" }, update: {}, create: { name: "startups" } }),
  ]);

  await Promise.all([
    db.contactBeat.upsert({
      where: { contactId_beatId: { contactId: journalist.id, beatId: saasBeat.id } },
      update: {},
      create: { contactId: journalist.id, beatId: saasBeat.id },
    }),
    db.contactBeat.upsert({
      where: { contactId_beatId: { contactId: journalist.id, beatId: devtoolsBeat.id } },
      update: {},
      create: { contactId: journalist.id, beatId: devtoolsBeat.id },
    }),
    db.contactBeat.upsert({
      where: { contactId_beatId: { contactId: podcaster.id, beatId: startupsBeat.id } },
      update: {},
      create: { contactId: podcaster.id, beatId: startupsBeat.id },
    }),
    db.contactBeat.upsert({
      where: { contactId_beatId: { contactId: influencer.id, beatId: saasBeat.id } },
      update: {},
      create: { contactId: influencer.id, beatId: saasBeat.id },
    }),
  ]);

  // Outlets
  const techPress = await db.outlet.upsert({
    where: { domain: "techpress.example" },
    update: {},
    create: {
      name: "TechPress",
      domain: "techpress.example",
      kind: "PUBLICATION",
      tier: "TIER_2",
    },
  });

  await db.contactOutlet.upsert({
    where: {
      contactId_outletId: { contactId: journalist.id, outletId: techPress.id },
    },
    update: { isPrimary: true, role: "Senior Writer" },
    create: {
      contactId: journalist.id,
      outletId: techPress.id,
      role: "Senior Writer",
      isPrimary: true,
    },
  });

  // Media list scoped to the demo campaign
  const mediaList = await db.mediaList.upsert({
    where: { id: "seed_media_list_1" },
    update: {},
    create: {
      id: "seed_media_list_1",
      brandId: brand.id,
      campaignId: campaign.id,
      name: "Q2 Launch Targets",
      description: "Tier-2 tech press + podcast hosts + SaaS creators.",
    },
  });

  await Promise.all(
    [journalist, podcaster, influencer].map((c, i) =>
      db.mediaListMember.upsert({
        where: {
          mediaListId_contactId: {
            mediaListId: mediaList.id,
            contactId: c.id,
          },
        },
        update: {},
        create: {
          mediaListId: mediaList.id,
          contactId: c.id,
          tier: i + 1,
          matchScore: [0.82, 0.74, 0.69][i],
        },
      }),
    ),
  );

  // ---------- Behavioral signals for Likelihood to Cover ----------
  // Give the journalist a realistic behavioral footprint so the score lands in
  // the high band (~90%) out of the box: prior replies to this brand, on-topic
  // and competitor coverage in the last 30 days, a funding-heavy corpus, and a
  // steady cadence. Other contacts stay thin so the table shows a real range
  // (and the confidence badge for low-signal rows).
  const DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

  // Competitors — one of these shows up in the journalist's recent coverage.
  await Promise.all([
    db.competitor.upsert({
      where: { id: "seed_competitor_1" },
      update: {},
      create: {
        id: "seed_competitor_1",
        brandId: brand.id,
        name: "Northwind SaaS",
        domain: "northwind.example",
      },
    }),
    db.competitor.upsert({
      where: { id: "seed_competitor_2" },
      update: {},
      create: {
        id: "seed_competitor_2",
        brandId: brand.id,
        name: "Boltline",
        domain: "boltline.example",
      },
    }),
  ]);

  // Journalist's recent work — topic ("product launch", "trial signups"),
  // competitor ("Northwind SaaS"), and funding signals, tightly dated.
  const journalistWork: Array<{ title: string; days: number }> = [
    { title: "Northwind SaaS raises $30M Series B to speed up product launches", days: 4 },
    { title: "The new wave of SaaS product launches to watch in 2026", days: 10 },
    { title: "Series A funding roundup: eight infra startups on the rise", days: 18 },
    { title: "How trial signups became every PLG team's north-star metric", days: 26 },
    { title: "Devtools consolidation continues as buyers cut stacks", days: 41 },
    { title: "SaaS pricing gets simpler — and why that matters", days: 56 },
  ];
  await Promise.all(
    journalistWork.map((w, i) =>
      db.recentWork.upsert({
        where: {
          contactId_url: {
            contactId: journalist.id,
            url: `https://techpress.example/articles/seed-${i}`,
          },
        },
        update: {},
        create: {
          contactId: journalist.id,
          title: w.title,
          url: `https://techpress.example/articles/seed-${i}`,
          publishedAt: daysAgo(w.days),
          source: "RSS",
        },
      }),
    ),
  );

  // Podcaster gets a lighter, on-topic footprint → a medium score.
  const podcasterWork = [
    { title: "Founder chat: shipping a product launch in two weeks", days: 12 },
    { title: "The trial-to-paid playbook for early SaaS", days: 33 },
  ];
  await Promise.all(
    podcasterWork.map((w, i) =>
      db.recentWork.upsert({
        where: {
          contactId_url: {
            contactId: podcaster.id,
            url: `https://buildshow.example/ep/seed-${i}`,
          },
        },
        update: {},
        create: {
          contactId: podcaster.id,
          title: w.title,
          url: `https://buildshow.example/ep/seed-${i}`,
          publishedAt: daysAgo(w.days),
          source: "RSS",
        },
      }),
    ),
  );

  // Prior brand-scoped interactions: pitched twice, replied twice (recently).
  const interactions: Array<{
    id: string;
    kind: "PITCH_SENT" | "REPLY_RECEIVED";
    days: number;
    summary: string;
  }> = [
    { id: "seed_int_1", kind: "PITCH_SENT", days: 48, summary: "Q1 feature pitch" },
    { id: "seed_int_2", kind: "REPLY_RECEIVED", days: 46, summary: "Replied — asked for a demo" },
    { id: "seed_int_3", kind: "PITCH_SENT", days: 24, summary: "Launch heads-up" },
    { id: "seed_int_4", kind: "REPLY_RECEIVED", days: 22, summary: "Replied — keen on an exclusive" },
  ];
  await Promise.all(
    interactions.map((it) =>
      db.contactInteraction.upsert({
        where: { id: it.id },
        update: {},
        create: {
          id: it.id,
          brandId: brand.id,
          contactId: journalist.id,
          campaignId: campaign.id,
          kind: it.kind,
          summary: it.summary,
          occurredAt: daysAgo(it.days),
        },
      }),
    ),
  );

  // An AI-inferred "prefers exclusives" flag (badged as a guess in the UI;
  // the user can confirm it from the drawer).
  await db.contactField.upsert({
    where: {
      contactId_key_source: {
        contactId: journalist.id,
        key: "prefersExclusives",
        source: "AI_INFERRED",
      },
    },
    update: {},
    create: {
      contactId: journalist.id,
      key: "prefersExclusives",
      value: "yes",
      source: "AI_INFERRED",
    },
  });

  console.log("Seed complete.");
  console.log({
    account: account.id,
    user: user.id,
    brand: brand.id,
    campaign: campaign.id,
    contacts: [journalist.id, podcaster.id, influencer.id],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
