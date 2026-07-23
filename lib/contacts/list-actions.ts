"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import {
  resolveCampaignTopicTerms,
  scoreContactsLikelihood,
} from "@/lib/contacts/likelihood-service";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function revalidateLists(listId?: string) {
  revalidatePath("/dashboard/lists");
  if (listId) revalidatePath(`/dashboard/lists/${listId}`);
  revalidatePath("/dashboard/strategize/targets");
  revalidatePath("/dashboard");
}

const CreateListInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  campaignId: z.string().min(1).optional().nullable(),
});

/** Create an empty media list, optionally attached to a campaign. */
export async function createMediaList(
  input: z.input<typeof CreateListInput>,
): Promise<ActionResult<{ listId: string }>> {
  const parsed = CreateListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const campaignId = await resolveCampaignId(parsed.data.campaignId, tenant.brand.id);
  if (campaignId === INVALID) {
    return { ok: false, error: "Campaign not found." };
  }

  const list = await db.mediaList.create({
    data: {
      brandId: tenant.brand.id,
      campaignId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
    select: { id: true },
  });
  revalidateLists(list.id);
  return { ok: true, listId: list.id };
}

const AddToListInput = z
  .object({
    contactIds: z.array(z.string().min(1)).min(1).max(500),
    /** Add to an existing list… */
    mediaListId: z.string().min(1).optional(),
    /** …or create a new one with this name. */
    newListName: z.string().trim().min(1).max(120).optional(),
    /** Only used when creating a new list. */
    campaignId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => Boolean(d.mediaListId) !== Boolean(d.newListName), {
    message: "Choose an existing list or name a new one, not both.",
  });

/**
 * Add contacts to a list — either an existing one (`mediaListId`) or a new
 * list created on the spot (`newListName`). Membership is de-duplicated, so
 * adding a contact already on the list is a no-op rather than an error.
 */
export async function addContactsToList(
  input: z.input<typeof AddToListInput>,
): Promise<ActionResult<{ listId: string; listName: string; added: number }>> {
  const parsed = AddToListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };
  const brandId = tenant.brand.id;

  let list: { id: string; name: string };
  if (parsed.data.mediaListId) {
    const found = await db.mediaList.findFirst({
      where: { id: parsed.data.mediaListId, brandId },
      select: { id: true, name: true },
    });
    if (!found) return { ok: false, error: "List not found." };
    list = found;
  } else {
    const campaignId = await resolveCampaignId(parsed.data.campaignId, brandId);
    if (campaignId === INVALID) return { ok: false, error: "Campaign not found." };
    list = await db.mediaList.create({
      data: { brandId, campaignId, name: parsed.data.newListName! },
      select: { id: true, name: true },
    });
  }

  // Only add contacts that actually exist (contacts are a shared directory).
  const valid = await db.contact.findMany({
    where: { id: { in: parsed.data.contactIds } },
    select: { id: true },
  });
  if (valid.length === 0) return { ok: false, error: "No valid contacts to add." };

  const result = await db.mediaListMember.createMany({
    data: valid.map((c) => ({ mediaListId: list.id, contactId: c.id })),
    skipDuplicates: true,
  });

  revalidateLists(list.id);
  return { ok: true, listId: list.id, listName: list.name, added: result.count };
}

const RemoveMemberInput = z.object({
  mediaListId: z.string().min(1),
  contactId: z.string().min(1),
});

export async function removeContactFromList(
  input: z.input<typeof RemoveMemberInput>,
): Promise<ActionResult> {
  const parsed = RemoveMemberInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const list = await db.mediaList.findFirst({
    where: { id: parsed.data.mediaListId, brandId: tenant.brand.id },
    select: { id: true },
  });
  if (!list) return { ok: false, error: "List not found." };

  await db.mediaListMember.deleteMany({
    where: { mediaListId: list.id, contactId: parsed.data.contactId },
  });
  revalidateLists(list.id);
  return { ok: true };
}

const RenameListInput = z.object({
  mediaListId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function renameMediaList(
  input: z.input<typeof RenameListInput>,
): Promise<ActionResult> {
  const parsed = RenameListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const list = await db.mediaList.findFirst({
    where: { id: parsed.data.mediaListId, brandId: tenant.brand.id },
    select: { id: true },
  });
  if (!list) return { ok: false, error: "List not found." };

  await db.mediaList.update({
    where: { id: list.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  revalidateLists(list.id);
  return { ok: true };
}

const DeleteListInput = z.object({ mediaListId: z.string().min(1) });

export async function deleteMediaList(
  input: z.input<typeof DeleteListInput>,
): Promise<ActionResult> {
  const parsed = DeleteListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };

  const list = await db.mediaList.findFirst({
    where: { id: parsed.data.mediaListId, brandId: tenant.brand.id },
    select: { id: true },
  });
  if (!list) return { ok: false, error: "List not found." };

  await db.mediaList.delete({ where: { id: list.id } });
  revalidateLists();
  return { ok: true };
}

const ExportListInput = z.object({ mediaListId: z.string().min(1) });

/**
 * Build a CSV of a list's members — contact details plus their current
 * Likelihood to Cover score and reason — for download. Returned as a string so
 * the client can trigger a Blob download (no file storage needed).
 */
export async function exportListCsv(
  input: z.input<typeof ExportListInput>,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  const parsed = ExportListInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tenant = await requireTenant();
  if (!tenant.brand) return { ok: false, error: "No brand selected." };
  const brandId = tenant.brand.id;

  const list = await db.mediaList.findFirst({
    where: { id: parsed.data.mediaListId, brandId },
    select: {
      id: true,
      name: true,
      campaign: { select: { id: true } },
      members: {
        select: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              kind: true,
              beats: { include: { beat: { select: { name: true } } } },
              outlets: {
                where: { isPrimary: true },
                take: 1,
                include: { outlet: { select: { name: true } } },
              },
              fields: { select: { key: true, value: true, source: true } },
              recentWork: {
                select: { title: true, excerpt: true, publishedAt: true },
                orderBy: { publishedAt: "desc" },
                take: 30,
              },
            },
          },
        },
      },
    },
  });
  if (!list) return { ok: false, error: "List not found." };

  const contacts = list.members.map((m) => m.contact);
  const topicTerms = list.campaign
    ? await resolveCampaignTopicTerms(brandId, list.campaign.id)
    : [];
  const likelihoodMap = await scoreContactsLikelihood(
    brandId,
    contacts.map((c) => ({
      contactId: c.id,
      recentWork: c.recentWork,
      fields: c.fields,
    })),
    { topicTerms },
  );

  const header = [
    "Name",
    "Email",
    "Outlet",
    "Title",
    "Type",
    "Beats",
    "Likelihood %",
    "Confidence %",
    "Reason",
  ];
  const rows = contacts.map((c) => {
    const l = likelihoodMap.get(c.id);
    const title = c.fields.find((f) => f.key === "title")?.value ?? "";
    const outlet =
      c.outlets[0]?.outlet.name ??
      c.fields.find((f) => f.key === "outletName")?.value ??
      "";
    return [
      c.name,
      c.email ?? "",
      outlet,
      title,
      c.kind,
      c.beats.map((b) => b.beat.name).join("; "),
      l ? String(l.score) : "",
      l ? String(l.confidence) : "",
      l?.rationale ?? "",
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const filename = `${slugify(list.name)}-list.csv`;
  return { ok: true, filename, csv };
}

/** RFC 4180 field escaping — quote when the value contains "," CR/LF or a quote. */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "media"
  );
}

// Sentinel distinguishing "no campaign" (null) from "campaign given but not
// owned by this brand" (invalid), so callers can 404 the latter.
const INVALID = Symbol("invalid-campaign");

async function resolveCampaignId(
  campaignId: string | null | undefined,
  brandId: string,
): Promise<string | null | typeof INVALID> {
  if (!campaignId) return null;
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    select: { id: true },
  });
  return campaign ? campaign.id : INVALID;
}
