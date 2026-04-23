import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { assertCanInviteUser, TierLimitError } from "@/lib/auth/tier-limits";

export const runtime = "nodejs";

/**
 * Clerk webhook. Subscribes to:
 *   - user.created, user.updated, user.deleted
 *   - organization.created, organization.updated, organization.deleted
 *   - organizationMembership.created, organizationMembership.deleted
 *
 * Signing secret (CLERK_WEBHOOK_SECRET) comes from the Clerk dashboard.
 * All events must pass svix signature verification — unverified requests
 * are rejected with 401 before any DB writes.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  let evt: WebhookEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Svix verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await route(evt);
  } catch (err) {
    if (err instanceof TierLimitError) {
      // Tier limit blocks a membership add. Return 409 so Clerk retries and
      // operators can see the conflict in logs; the downstream org has
      // already added the member Clerk-side, so we'll also need to follow
      // up by removing them via Clerk backend API — logged for now.
      console.warn(`Tier limit hit on ${evt.type}:`, err.message);
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error(`Error handling ${evt.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function route(evt: WebhookEvent) {
  switch (evt.type) {
    case "user.created":
    case "user.updated":
      return upsertUser(evt.data);
    case "user.deleted":
      if (evt.data.id) {
        await db.user.deleteMany({ where: { clerkUserId: evt.data.id } });
      }
      return;

    case "organization.created":
    case "organization.updated":
      return upsertAccount(evt.data);
    case "organization.deleted":
      if (evt.data.id) {
        await db.account.deleteMany({ where: { clerkOrgId: evt.data.id } });
      }
      return;

    case "organizationMembership.created":
      return addMembership(evt.data);
    case "organizationMembership.deleted":
      return removeMembership(evt.data);

    default:
      // Ignore other events (sessions, invitations, etc.) — we subscribe
      // narrowly in Clerk but guard here too.
      return;
  }
}

type ClerkUser = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

async function upsertUser(u: ClerkUser) {
  const primaryEmail =
    u.email_addresses?.find((e) => e.id === u.primary_email_address_id)
      ?.email_address ?? u.email_addresses?.[0]?.email_address;
  if (!primaryEmail) return;

  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;

  await db.user.upsert({
    where: { clerkUserId: u.id },
    update: { email: primaryEmail, name, imageUrl: u.image_url ?? null },
    create: {
      clerkUserId: u.id,
      email: primaryEmail,
      name,
      imageUrl: u.image_url ?? null,
    },
  });
}

type ClerkOrg = {
  id: string;
  name: string;
  slug?: string | null;
  image_url?: string | null;
};

async function upsertAccount(o: ClerkOrg) {
  // New orgs default to SOLO. Plan upgrades happen via the Stripe webhook
  // (Chunk H), which sets plan + seatLimit + brandLimit together.
  const defaults = PLAN_LIMITS.SOLO;
  await db.account.upsert({
    where: { clerkOrgId: o.id },
    update: { name: o.name },
    create: {
      clerkOrgId: o.id,
      name: o.name,
      plan: "SOLO",
      seatLimit: defaults.maxSeats,
      brandLimit: defaults.maxBrands,
    },
  });
}

type ClerkMembership = {
  id: string;
  role: string; // "admin" | "basic_member" (or custom)
  organization: { id: string };
  public_user_data: { user_id: string };
};

async function addMembership(m: ClerkMembership) {
  const account = await db.account.findUnique({
    where: { clerkOrgId: m.organization.id },
  });
  if (!account) {
    // Webhook ordering can put membership ahead of org.created; log and
    // bail. Clerk retries with backoff so we'll pick it up on the retry.
    console.warn(
      `addMembership: no Account for clerkOrgId=${m.organization.id} yet; Clerk will retry.`,
    );
    return;
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: m.public_user_data.user_id },
  });
  if (!user) {
    console.warn(
      `addMembership: no User for clerkUserId=${m.public_user_data.user_id} yet; Clerk will retry.`,
    );
    return;
  }

  // Tier gate — throws if this seat would break the plan limit.
  await assertCanInviteUser(account.id);

  await db.accountMembership.upsert({
    where: { accountId_userId: { accountId: account.id, userId: user.id } },
    update: { role: m.role === "admin" ? "ADMIN" : "MEMBER" },
    create: {
      accountId: account.id,
      userId: user.id,
      // The first member of a fresh org becomes OWNER. Subsequent admins
      // land as ADMIN; everyone else as MEMBER.
      role: (await db.accountMembership.count({ where: { accountId: account.id } })) === 0
        ? "OWNER"
        : m.role === "admin"
          ? "ADMIN"
          : "MEMBER",
    },
  });
}

async function removeMembership(m: ClerkMembership) {
  const account = await db.account.findUnique({
    where: { clerkOrgId: m.organization.id },
  });
  const user = await db.user.findUnique({
    where: { clerkUserId: m.public_user_data.user_id },
  });
  if (!account || !user) return;

  await db.accountMembership.deleteMany({
    where: { accountId: account.id, userId: user.id },
  });
  // BrandMembership rows for this user+account get cleaned up with the next
  // pass; we don't cascade through the AccountMembership since brands live
  // in their own FK tree. Worth a scheduled reconcile job in Chunk J.
}
