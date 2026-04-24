import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { renderReportPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportType = "status" | "media-brief" | "talking-points";

/**
 * Stream a PDF for one of the three on-demand reports. Access is scoped
 * to the caller's account via the report's campaign → brand → account
 * chain, so a leaked URL can't be used by a different tenant.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: ReportType; id: string }> },
) {
  const { type, id } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "";
  let subtitle: string | undefined;
  let markdown = "";
  let brandId: string;
  let brandName = "";
  let brandLogoUrl: string | null = null;

  if (type === "status") {
    const doc = await db.statusReportDoc.findFirst({
      where: {
        id,
        campaign: { brand: { accountId: tenant.account.id } },
      },
      include: {
        campaign: {
          include: {
            brand: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    title = `Status report: ${doc.campaign.title}`;
    subtitle = `Generated ${doc.generatedAt.toLocaleString()}`;
    markdown = doc.markdown;
    brandId = doc.campaign.brand.id;
    brandName = doc.campaign.brand.name;
    brandLogoUrl = doc.campaign.brand.logoUrl;
  } else if (type === "media-brief") {
    const doc = await db.mediaBriefDoc.findFirst({
      where: { id },
      include: {
        contact: { select: { id: true, name: true } },
        campaign: {
          include: {
            brand: { select: { id: true, name: true, logoUrl: true, accountId: true } },
          },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Account-scope via the brand. Briefs without a campaign are
    // considered account-scoped only if we can resolve the caller's
    // current brand ID — safer to require the campaign link for now.
    if (!doc.campaign || doc.campaign.brand.accountId !== tenant.account.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    title = `Media brief: ${doc.contact.name}`;
    subtitle = `Generated ${doc.generatedAt.toLocaleString()}`;
    markdown = doc.markdown;
    brandId = doc.campaign.brand.id;
    brandName = doc.campaign.brand.name;
    brandLogoUrl = doc.campaign.brand.logoUrl;
  } else if (type === "talking-points") {
    const doc = await db.talkingPointsDoc.findFirst({
      where: {
        id,
        campaign: { brand: { accountId: tenant.account.id } },
      },
      include: {
        campaign: {
          include: {
            brand: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    title = `Talking points: ${doc.campaign.title}`;
    subtitle = `Generated ${doc.generatedAt.toLocaleString()}`;
    markdown = doc.markdown;
    brandId = doc.campaign.brand.id;
    brandName = doc.campaign.brand.name;
    brandLogoUrl = doc.campaign.brand.logoUrl;
  } else {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const pdf = await renderReportPdf({
    title,
    subtitle,
    markdown,
    brandName,
    brandLogoUrl,
  });

  // Reference brandId to satisfy the unused-var linter while keeping the
  // variable available for future enhancements (watermarking by brand).
  void brandId;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(title)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80);
}
