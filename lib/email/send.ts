"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireTenant } from "@/lib/auth/tenant";
import { instrumentEmailHtml, textToHtml } from "@/lib/email/tracking";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Lazily constructed so missing RESEND_API_KEY only errors when we send. */
function resend() {
  return new Resend(env.RESEND_API_KEY);
}

const SendInput = z.object({
  pitchIds: z.array(z.string().min(1)).min(1).max(200),
  /** Override the From address (must be a verified Resend sender). */
  fromAddress: z.string().trim().email().optional(),
});

/**
 * Send a batch of APPROVED pitches via Resend. Throttled to 1 send every
 * 3 seconds so outbound doesn't look like a spam burst — PR sends should
 * feel human-paced. Each send produces an EmailSend row first (so we have
 * a stable `trackingPixelId` to inject), then the email, then the `sentAt`
 * stamp + Pitch status bump.
 *
 * NOTE: Gmail/Outlook OAuth (`sendPath: OAUTH_MAILBOX`) is deferred; for
 * now we always use `sendPath: RESEND`. The EmailSend schema supports
 * both so the Chunk-F implementation slots in cleanly.
 */
export async function sendApprovedPitches(
  input: z.infer<typeof SendInput>,
): Promise<
  ActionResult<{ sent: number; failed: number; errors: string[] }>
> {
  const parsed = SendInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tenant = await requireTenant();
  const pitches = await db.pitch.findMany({
    where: {
      id: { in: parsed.data.pitchIds },
      status: "APPROVED",
      campaign: { brand: { accountId: tenant.account.id } },
    },
    include: {
      contact: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, brandId: true } },
    },
  });

  if (pitches.length === 0) {
    return { ok: false, error: "No approved pitches in that selection." };
  }

  const from =
    parsed.data.fromAddress ||
    process.env.RESEND_FROM_EMAIL ||
    "PitchFlare <onboarding@resend.dev>";
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const contact = pitch.contact;
    if (!contact?.email) {
      failed += 1;
      errors.push(`${contact?.name ?? pitch.contactId}: no email address on file.`);
      continue;
    }

    try {
      const send = await db.emailSend.create({
        data: {
          pitchId: pitch.id,
          contactId: contact.id,
          sendPath: "RESEND",
          fromAddress: from,
          toAddress: contact.email,
          subject: pitch.subject,
        },
      });

      const html = instrumentEmailHtml(
        /<\/(p|div|body|html)>/i.test(pitch.body) ? pitch.body : textToHtml(pitch.body),
        send.trackingPixelId,
      );

      const { data, error } = await resend().emails.send({
        from,
        to: contact.email,
        subject: pitch.subject,
        html,
      });
      if (error) throw new Error(error.message);

      await db.$transaction([
        db.emailSend.update({
          where: { id: send.id },
          data: { messageId: data?.id ?? null },
        }),
        db.pitch.update({
          where: { id: pitch.id },
          data: { status: "SENT", sentAt: new Date() },
        }),
        db.contactInteraction.create({
          data: {
            brandId: pitch.campaign.brandId,
            contactId: contact.id,
            campaignId: pitch.campaign.id,
            kind: "PITCH_SENT",
            summary: pitch.subject,
          },
        }),
      ]);
      sent += 1;
    } catch (err) {
      failed += 1;
      errors.push(
        `${contact.name}: ${err instanceof Error ? err.message : "send failed"}`,
      );
    }

    // 1 send per 3 seconds throttle. Skip on the last iteration so we
    // don't waste a wall-clock sleep at the end.
    if (i < pitches.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  revalidatePath("/dashboard/execute/email");
  revalidatePath("/dashboard/draft/pitches");
  return { ok: true, sent, failed, errors };
}
