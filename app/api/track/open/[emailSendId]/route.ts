import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1x1 transparent GIF bytes (42 bytes).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/**
 * Open-tracking pixel. Looked up by `trackingPixelId` on EmailSend. Writes
 * openedAt on the first hit and records an EmailEvent row per hit — email
 * clients cache aggressively so first-open is reliable and subsequent
 * opens are noisy; we keep them all so the Analyze dashboard can decide
 * what to trust.
 *
 * Always returns the pixel (with no-cache headers), regardless of whether
 * the lookup found a row — never leak existence via an HTTP status.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailSendId: string }> },
) {
  const { emailSendId } = await params;
  try {
    const send = await db.emailSend.findUnique({
      where: { trackingPixelId: emailSendId },
      select: { id: true, openedAt: true },
    });
    if (send) {
      await db.emailEvent.create({
        data: { emailSendId: send.id, type: "OPENED" },
      });
      if (!send.openedAt) {
        await db.emailSend.update({
          where: { id: send.id },
          data: { openedAt: new Date() },
        });
      }
    }
  } catch (err) {
    console.error("open tracking failed:", err);
    // Still return the pixel — never let a DB blip break image loading.
  }

  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
