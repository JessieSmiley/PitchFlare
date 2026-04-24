import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Account, Brand, User } from "@prisma/client";

/** Cookie key for the user's "currently selected brand" within an account. */
export const CURRENT_BRAND_COOKIE = "pf_current_brand";

export class TenantError extends Error {
  code: "NOT_AUTHENTICATED" | "NO_ORG" | "NO_ACCOUNT" | "NO_USER_ROW" | "NO_BRAND";
  constructor(
    code: TenantError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "TenantError";
  }
}

export type Tenant = {
  account: Account;
  user: User;
  /** May be null if the account has no brands yet (pre-onboarding state). */
  brand: Brand | null;
  /** Clerk role (admin | basic_member) — maps loosely to OWNER/ADMIN/MEMBER. */
  role: string | null;
};

/**
 * Resolve the current authenticated tenant: the caller's User row, their
 * active Account (via Clerk `orgId`), and their currently-selected Brand.
 *
 * Throws TenantError on every failure mode so callers can handle them
 * explicitly instead of threading three different null checks.
 */
export async function requireTenant(): Promise<Tenant> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) {
    throw new TenantError("NOT_AUTHENTICATED", "Not signed in.");
  }
  if (!orgId) {
    throw new TenantError("NO_ORG", "No organization selected.");
  }

  const account = await db.account.findUnique({ where: { clerkOrgId: orgId } });
  if (!account) {
    throw new TenantError(
      "NO_ACCOUNT",
      "Account not provisioned yet. If this persists, check that the Clerk webhook is reaching /api/webhooks/clerk.",
    );
  }

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) {
    throw new TenantError(
      "NO_USER_ROW",
      "User row missing. Check that the user.created Clerk webhook fired.",
    );
  }

  const brand = await resolveCurrentBrand(account.id, user.id);

  return { account, user, brand, role: orgRole ?? null };
}

/**
 * Softer variant of `requireTenant` — returns null instead of throwing when
 * the user isn't signed in or hasn't picked an org yet. Useful in layouts /
 * middleware where we want to render an onboarding redirect rather than
 * blow up the request.
 */
export async function getTenant(): Promise<Tenant | null> {
  try {
    return await requireTenant();
  } catch (e) {
    if (e instanceof TenantError) return null;
    throw e;
  }
}

async function resolveCurrentBrand(
  accountId: string,
  userId: string,
): Promise<Brand | null> {
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(CURRENT_BRAND_COOKIE)?.value;

  // If the cookie points at a brand this user can access in this account, use it.
  if (preferredId) {
    const preferred = await db.brand.findFirst({
      where: {
        id: preferredId,
        accountId,
        memberships: { some: { userId } },
      },
    });
    if (preferred) return preferred;
  }

  // Fall back to the first brand they belong to in this account (stable by
  // creation order so nav doesn't jump around).
  return db.brand.findFirst({
    where: { accountId, memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Used by the brand switcher dropdown to list every option. */
export async function listAccessibleBrands(
  accountId: string,
  userId: string,
): Promise<Brand[]> {
  return db.brand.findMany({
    where: { accountId, memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get Clerk user profile — only call when you need fields we don't mirror
 * locally (e.g. image URL). Keep most queries against our `User` table so
 * a Clerk outage doesn't kill the app.
 */
export async function getClerkUser() {
  return currentUser();
}
