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
