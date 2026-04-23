import { db } from "@/lib/db";
import { canAddBrand, canAddSeat } from "@/lib/plans";

export class TierLimitError extends Error {
  code: "SEAT_LIMIT" | "BRAND_LIMIT" | "COUPLED_LIMIT";
  constructor(code: TierLimitError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "TierLimitError";
  }
}

/**
 * Throws TierLimitError if creating one more brand would exceed the
 * account's plan limits. Call this BEFORE every brand-creation path
 * (onboarding, Settings → Brands, Clerk org-membership-created webhook).
 */
export async function assertCanCreateBrand(accountId: string): Promise<void> {
  const [account, seats, brands] = await Promise.all([
    db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { plan: true },
    }),
    db.accountMembership.count({ where: { accountId } }),
    db.brand.count({ where: { accountId } }),
  ]);

  const check = canAddBrand(account.plan, seats, brands);
  if (!check.ok) throw new TierLimitError(check.code, check.reason);
}

/**
 * Throws TierLimitError if inviting one more user would exceed the
 * account's plan limits. Call this from the invite-user flow and from
 * the Clerk webhook when a new organizationMembership is received.
 */
export async function assertCanInviteUser(accountId: string): Promise<void> {
  const [account, seats, brands] = await Promise.all([
    db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { plan: true },
    }),
    db.accountMembership.count({ where: { accountId } }),
    db.brand.count({ where: { accountId } }),
  ]);

  const check = canAddSeat(account.plan, seats, brands);
  if (!check.ok) throw new TierLimitError(check.code, check.reason);
}
