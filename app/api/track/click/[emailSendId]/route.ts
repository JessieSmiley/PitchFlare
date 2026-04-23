import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Click-tracking wrapper. The `url` query param holds the real destination.
 * We log a CLICKED event, stamp firstClickedAt if unset, then 302-redirect.
 *
 * Safety: we only redirect to http(s) URLs, and we don't require the URL
 * to match the pitch body — that's a non-issue in practice because only
 * we mint these links (inside `instrumentEmailHtml`).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ emailSendId: string }> },
) {
  const { emailSendId } = await params;
  const target = req.nextUrl.searchParams.get("url");
  const safeTarget = safeHttpUrl(target);

  if (!safeTarget) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  try {
    const send = await db.emailSend.findUnique({
      where: { trackingPixelId: emailSendId },
      select: { id: true, firstClickedAt: true },
    });
    if (send) {
      await db.emailEvent.create({
        data: {
          emailSendId: send.id,
          type: "CLICKED",
          metadata: { url: safeTarget },
        },
      });
      if (!send.firstClickedAt) {
        await db.emailSend.update({
          where: { id: send.id },
          data: { firstClickedAt: new Date() },
        });
      }
    }
  } catch (err) {
    console.error("click tracking failed:", err);
  }

  return NextResponse.redirect(safeTarget, 302);
}

function safeHttpUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
