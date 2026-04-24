import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { queryGoogleNewsRss } from "@/lib/monitoring/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — long enough for 50 active queries.

/**
 * Vercel Cron entrypoint. Set up in vercel.json (Chunk J) with a 6-hour
 * schedule. Iterates active MonitoringQuery rows, fetches Google News RSS
 * per keyword, dedupes, writes Mention rows. Does NOT auto-promote to
 * CoverageClip — users triage via the Analyze UI. That keeps sentiment +
 * reach spend under user control.
 *
 * Auth: Vercel sets the `Authorization: Bearer $CRON_SECRET` header on
 * scheduled invocations. In dev you can call it directly without the
 * header.
 */
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const queries = await db.monitoringQuery.findMany({
    where: { active: true },
    select: {
      id: true,
      keywords: true,
      brandId: true,
      campaignId: true,
    },
    take: 200,
  });

  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: Array<{ queryId: string; error: string }> = [];

  for (const q of queries) {
    for (const kw of q.keywords) {
      try {
        const hits = await queryGoogleNewsRss(kw);
        for (const hit of hits.slice(0, 25)) {
          const existing = await db.mention.findUnique({
            where: { dedupeKey: hit.dedupeKey },
            select: { id: true },
          });
          if (existing) {
            totalSkipped += 1;
            continue;
          }
          await db.mention.create({
            data: {
              monitoringQueryId: q.id,
              dedupeKey: hit.dedupeKey,
              url: hit.url,
              title: hit.title,
              excerpt: hit.excerpt,
              outletName: hit.outletName,
              author: hit.author,
              publishedAt: hit.publishedAt,
              sourceProvider: hit.sourceProvider,
            },
          });
          totalInserted += 1;
        }
      } catch (e) {
        errors.push({
          queryId: q.id,
          error: e instanceof Error ? e.message : "fetch failed",
        });
      }
    }
    await db.monitoringQuery.update({
      where: { id: q.id },
      data: { lastRunAt: new Date() },
    });
  }

  return NextResponse.json({
    ok: true,
    queries: queries.length,
    inserted: totalInserted,
    skipped: totalSkipped,
    errors,
  });
}
