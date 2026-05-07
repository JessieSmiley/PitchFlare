import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import type { Account, AccountRole, User } from "@prisma/client";

/**
 * Tenant provisioning is normally driven by the Clerk webhook
 * (`app/api/webhooks/clerk/route.ts`). The helpers here exist so the same
 * write paths can also run synchronously from a server component when the
 * webhook hasn't landed yet — e.g. the user is staring at the onboarding
 * "Finishing setup…" screen because Svix is delivering slowly or the
 * webhook endpoint is misconfigured.
 *
 * Every function here is idempotent.
 */

type ClerkOrgInput = { id: string; name: string };
type ClerkUserInput = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

export async function upsertAccountFromClerkOrg(
  org: ClerkOrgInput,
): Promise<Account> {
  const defaults = PLAN_LIMITS.SOLO;
  return db.account.upsert({
    where: { clerkOrgId: org.id },
    update: { name: org.name },
    create: {
      clerkOrgId: org.id,
      name: org.name,
      plan: "SOLO",
      seatLimit: defaults.maxSeats,
      brandLimit: defaults.maxBrands,
    },
  });
}

export async function upsertUserFromClerk(u: ClerkUserInput): Promise<User> {
  return db.user.upsert({
    where: { clerkUserId: u.id },
    update: { email: u.email, name: u.name, imageUrl: u.imageUrl },
    create: {
      clerkUserId: u.id,
      email: u.email,
      name: u.name,
      imageUrl: u.imageUrl,
    },
  });
}

/**
 * Ensure an AccountMembership row exists for (account, user). The first
 * member of a fresh account becomes OWNER — same rule the webhook applies.
 */
export async function ensureAccountMembership(
  accountId: string,
  userId: string,
  clerkRole: string | null,
): Promise<void> {
  const existing = await db.accountMembership.findUnique({
    where: { accountId_userId: { accountId, userId } },
    select: { id: true },
  });
  if (existing) return;

  const isFirst =
    (await db.accountMembership.count({ where: { accountId } })) === 0;
  const role: AccountRole = isFirst
    ? "OWNER"
    : clerkRole === "admin"
      ? "ADMIN"
      : "MEMBER";

  await db.accountMembership.create({
    data: { accountId, userId, role },
  });
}

/**
 * Self-heal entry point for the onboarding page. Given an authenticated
 * Clerk user + active org, make sure the corresponding User, Account, and
 * AccountMembership rows all exist. Safe to call when they already do.
 *
 * Returns the resolved Account + User so callers can avoid an extra round
 * trip.
 */
export async function provisionTenantForCurrentUser(args: {
  clerkUserId: string;
  clerkOrgId: string;
  clerkOrgRole: string | null;
}): Promise<{ account: Account; user: User }> {
  const clerk = await clerkClient();

  const [clerkUser, clerkOrg] = await Promise.all([
    clerk.users.getUser(args.clerkUserId),
    clerk.organizations.getOrganization({ organizationId: args.clerkOrgId }),
  ]);

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    throw new Error(
      `Clerk user ${args.clerkUserId} has no email address; cannot provision.`,
    );
  }

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [account, user] = await Promise.all([
    upsertAccountFromClerkOrg({ id: clerkOrg.id, name: clerkOrg.name }),
    upsertUserFromClerk({
      id: clerkUser.id,
      email: primaryEmail,
      name: fullName,
      imageUrl: clerkUser.imageUrl ?? null,
    }),
  ]);

  await ensureAccountMembership(account.id, user.id, args.clerkOrgRole);

  return { account, user };
}
