import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganization } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { provisionTenantForCurrentUser } from "@/lib/auth/provisioning";

export default async function OnboardingPage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");

  if (orgId) {
    let account = await db.account.findUnique({
      where: { clerkOrgId: orgId },
    });

    // The Clerk webhook is the normal provisioning path, but it can race the
    // post-signup redirect or be misconfigured entirely. Provision inline so
    // the user is never stuck on a holding screen.
    if (!account) {
      try {
        ({ account } = await provisionTenantForCurrentUser({
          clerkUserId: userId,
          clerkOrgId: orgId,
          clerkOrgRole: orgRole ?? null,
        }));
      } catch (err) {
        console.error("Inline tenant provisioning failed:", err);
        return (
          <div>
            <h1 className="font-display text-2xl text-brand-navy">
              We hit a snag finishing setup
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Refresh to try again. If this keeps happening, contact support
              and mention org id <code className="font-mono">{orgId}</code>.
            </p>
          </div>
        );
      }
    }

    redirect("/onboarding/brand");
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-brand-navy">
        Create your organization
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your organization is your billing account. Solo users can name this
        whatever they want (e.g. &ldquo;Jane&rsquo;s PR&rdquo;). Agencies use
        the agency name.
      </p>
      <div className="mt-6">
        <CreateOrganization afterCreateOrganizationUrl="/onboarding/brand" />
      </div>
    </div>
  );
}
