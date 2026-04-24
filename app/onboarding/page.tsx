import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganization } from "@clerk/nextjs";
import { db } from "@/lib/db";

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  // If they already have an org, check if the Account got provisioned. If it
  // has, funnel them to brand creation; if not, we'll render a helpful note
  // while the webhook catches up.
  if (orgId) {
    const account = await db.account.findUnique({
      where: { clerkOrgId: orgId },
    });
    if (account) redirect("/onboarding/brand");
    return (
      <div>
        <h1 className="font-display text-2xl text-brand-navy">
          Finishing setup…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re provisioning your account. This usually takes a few
          seconds. Refresh the page if it doesn&apos;t move along.
        </p>
      </div>
    );
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
