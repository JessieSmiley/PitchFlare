"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { scrapeAuthorPage } from "@/lib/contacts/scrape";
import { scoreContactsForCampaign } from "@/lib/contacts/match";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const CreateContactInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["JOURNALIST", "PODCASTER", "INFLUENCER", "ANALYST", "OUTLET"]),
  email: z.string().trim().email().optional().or(z.literal("")),
  outletName: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  beats: z.array(z.string().trim()).max(20).optional(),
});

export async function createContact(
  input: z.infer<typeof CreateContactInput>,
): Promise<ActionResult<{ contactId: string }>> {
  const parsed = CreateContactInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const contact = await db.contact.create({
    data: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      email: parsed.data.email || null,
      bio: parsed.data.bio || null,
    },
    select: { id: true },
  });

  if (parsed.data.outletName) {
    const outlet = await db.outlet.upsert({
      where: {
        domain: `manual:${parsed.data.outletName.toLowerCase().replace(/\s+/g, "-")}`,
      },
      create: {
        name: parsed.data.outletName,
        domain: `manual:${parsed.data.outletName.toLowerCase().replace(/\s+/g, "-")}`,
        kind:
          parsed.data.kind === "PODCASTER"
            ? "PODCAST"
            : parsed.data.kind === "INFLUENCER"
              ? "SOCIAL"
              : "PUBLICATION",
      },
      update: {},
    });
    await db.contactOutlet.create({
      data: { contactId: contact.id, outletId: outlet.id, isPrimary: true },
    });
  }

  if (parsed.data.beats?.length) {
    await connectBeats(contact.id, parsed.data.beats);
  }

  // Seed the brand-scoped interaction ledger (empty — just so the contact
  // shows in this brand's history view going forward).
  await db.contactInteraction.create({
    data: {
      brandId: tenant.brand.id,
      contactId: contact.id,
      kind: "NOTE",
      summary: "Added to brand",
    },
  });

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, contactId: contact.id };
}

async function connectBeats(contactId: string, names: string[]) {
  const unique = Array.from(new Set(names.map((b) => b.toLowerCase().trim()))).filter(
    Boolean,
  );
  for (const name of unique) {
    const beat = await db.beat.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await db.contactBeat
      .create({ data: { contactId, beatId: beat.id } })
      .catch(() => null); // ignore duplicate-key on existing pairs
  }
}

const ImportFromUrlInput = z.object({
  url: z.string().trim().url(),
  kind: z
    .enum(["JOURNALIST", "PODCASTER", "INFLUENCER", "ANALYST", "OUTLET"])
    .default("JOURNALIST"),
});

export async function importContactFromUrl(
  input: z.infer<typeof ImportFromUrlInput>,
): Promise<ActionResult<{ contactId: string }>> {
  const parsed = ImportFromUrlInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  let scraped;
  try {
    scraped = await scrapeAuthorPage(parsed.data.url);
  } catch (e) {
    return {
      ok: false,
      error: `Could not fetch ${parsed.data.url}. ${e instanceof Error ? e.message : ""}`.trim(),
    };
  }

  if (!scraped.name) {
    return {
      ok: false,
      error: "Couldn't find a name on that page. Try the author's profile page directly.",
    };
  }

  const contact = await db.contact.create({
    data: {
      name: scraped.name,
      kind: parsed.data.kind,
      bio: scraped.bio,
      avatarUrl: scraped.avatarUrl,
      // Every scraped field also gets a ContactField row so provenance
      // shows up in the profile drawer ("Source: Auto-scraped").
      fields: {
        create: [
          scraped.title && {
            key: "title",
            value: scraped.title,
            source: "AUTO_SCRAPED" as const,
          },
          scraped.outletName && {
            key: "outletName",
            value: scraped.outletName,
            source: "AUTO_SCRAPED" as const,
          },
        ].filter(Boolean) as Array<{
          key: string;
          value: string;
          source: "AUTO_SCRAPED";
        }>,
      },
      recentWork: {
        create: scraped.recentLinks.map((rw) => ({
          title: rw.title,
          url: rw.url,
          source: "SCRAPE" as const,
        })),
      },
    },
    select: { id: true },
  });

  // Attach to an Outlet if we could identify one.
  if (scraped.outletName) {
    let domain: string | null = null;
    try {
      domain = new URL(parsed.data.url).hostname.replace(/^www\./, "");
    } catch {
      domain = null;
    }
    if (domain) {
      const outlet = await db.outlet.upsert({
        where: { domain },
        create: {
          name: scraped.outletName,
          domain,
          kind: parsed.data.kind === "PODCASTER" ? "PODCAST" : "PUBLICATION",
        },
        update: {},
      });
      await db.contactOutlet.create({
        data: { contactId: contact.id, outletId: outlet.id, isPrimary: true },
      });
    }
  }

  await db.contactInteraction.create({
    data: {
      brandId: tenant.brand.id,
      contactId: contact.id,
      kind: "NOTE",
      summary: `Imported from ${parsed.data.url}`,
    },
  });

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, contactId: contact.id };
}

const BuildTargetListInput = z.object({
  campaignId: z.string().min(1),
  /** Optional — defaults to the campaign's primary angle's fields. */
  angleTerms: z.array(z.string()).optional(),
  preferredKinds: z
    .array(
      z.enum(["JOURNALIST", "PODCASTER", "INFLUENCER", "ANALYST", "OUTLET"]),
    )
    .optional(),
  listName: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Given a campaign, build a MediaList of the top-N scoring contacts
 * against the primary angle. Users can then edit the list by hand.
 */
export async function buildTargetListFromAngle(
  input: z.infer<typeof BuildTargetListInput>,
): Promise<ActionResult<{ mediaListId: string; count: number }>> {
  const parsed = BuildTargetListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  const campaign = await db.campaign.findFirst({
    where: {
      id: parsed.data.campaignId,
      brand: { accountId: tenant.account.id },
    },
    include: { primaryAngle: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const terms =
    parsed.data.angleTerms ??
    [
      campaign.title,
      campaign.objective,
      campaign.primaryAngle?.title,
      campaign.primaryAngle?.hook,
      campaign.primaryAngle?.audienceFit,
      ...(campaign.toneTags ?? []),
    ].filter((s): s is string => Boolean(s && s.length));

  if (terms.length === 0) {
    return {
      ok: false,
      error: "No angle terms to match against. Set a primary angle first.",
    };
  }

  const scored = await scoreContactsForCampaign(
    campaign.brandId,
    {
      campaignAngleTerms: terms,
      preferredMediaTypes: parsed.data.preferredKinds ?? [
        "JOURNALIST",
        "PODCASTER",
        "INFLUENCER",
      ],
    },
    { limit: parsed.data.limit },
  );

  const list = await db.mediaList.create({
    data: {
      brandId: campaign.brandId,
      campaignId: campaign.id,
      name:
        parsed.data.listName ??
        `Targets: ${campaign.primaryAngle?.title ?? campaign.title}`,
      description: "Auto-built from primary angle.",
      members: {
        create: scored.map((s, i) => ({
          contactId: s.contactId,
          tier: i < 5 ? 1 : i < 15 ? 2 : 3,
          matchScore: s.score,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/strategize/targets");
  return { ok: true, mediaListId: list.id, count: scored.length };
}
