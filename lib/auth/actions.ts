"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant, CURRENT_BRAND_COOKIE } from "@/lib/auth/tenant";
import { assertCanCreateBrand, TierLimitError } from "@/lib/auth/tier-limits";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "brand";

async function ensureUniqueSlug(accountId: string, base: string) {
  let slug = base;
  let n = 1;
  while (
    await db.brand.findUnique({
      where: { accountId_slug: { accountId, slug } },
      select: { id: true },
    })
  ) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

const CreateBrandInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  website: z.string().trim().url("Must be a valid URL").optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
});

/**
 * Create a new brand in the current account. Tier-gated by
 * `assertCanCreateBrand`. Automatically enrolls the creating user as a
 * BrandMembership so they can see the brand in the switcher.
 */
export async function createBrandAction(
  input: z.infer<typeof CreateBrandInput>,
): Promise<
  | { ok: true; brandId: string; slug: string }
  | { ok: false; error: string; code?: string }
> {
  const parsed = CreateBrandInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();

  try {
    await assertCanCreateBrand(tenant.account.id);
  } catch (e) {
    if (e instanceof TierLimitError) {
      return { ok: false, error: e.message, code: e.code };
    }
    throw e;
  }

  const slug = await ensureUniqueSlug(
    tenant.account.id,
    slugify(parsed.data.name),
  );

  const brand = await db.brand.create({
    data: {
      accountId: tenant.account.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      website: parsed.data.website ?? null,
      category: parsed.data.category ?? null,
      memberships: { create: { userId: tenant.user.id } },
    },
    select: { id: true, slug: true },
  });

  // Make it the active brand immediately — the switcher will reflect it on
  // next render.
  (await cookies()).set(CURRENT_BRAND_COOKIE, brand.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  return { ok: true, brandId: brand.id, slug: brand.slug };
}

/**
 * Switch the active brand for this user. Validates that the user actually
 * has access to the target brand before writing the cookie.
 */
export async function switchBrandAction(
  brandId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await requireTenant();

  const brand = await db.brand.findFirst({
    where: {
      id: brandId,
      accountId: tenant.account.id,
      memberships: { some: { userId: tenant.user.id } },
    },
    select: { id: true },
  });
  if (!brand) {
    return { ok: false, error: "Brand not found or you don't have access." };
  }

  (await cookies()).set(CURRENT_BRAND_COOKIE, brand.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Convenience wrapper used by the onboarding page. */
export async function createFirstBrandAndGoToDashboard(formData: FormData) {
  const result = await createBrandAction({
    name: String(formData.get("name") ?? ""),
    website: (formData.get("website") as string) || null,
    category: (formData.get("category") as string) || null,
  });
  if (!result.ok) {
    // The page will pick this up via a rethrow → error boundary in Chunk J.
    throw new Error(result.error);
  }
  redirect("/dashboard");
}
