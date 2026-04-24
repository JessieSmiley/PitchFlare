import { env } from "@/lib/env";

/**
 * Rewrite a pitch body to include:
 *   1. A 1x1 tracking pixel keyed on `trackingPixelId` at the bottom of the
 *      HTML body — captures open events.
 *   2. Every outbound anchor href wrapped in
 *      `${APP_URL}/api/track/click/${trackingPixelId}?url=${encoded}` —
 *      captures click events, then 302s the user to the real URL.
 *
 * We work on HTML; text-only bodies skip wrapping (no anchors to rewrite).
 * Email clients cache pixels, so first-open timestamps are reliable but
 * subsequent opens are noisy — document that in the Analyze UI when it
 * consumes these events.
 */
export function instrumentEmailHtml(
  html: string,
  trackingPixelId: string,
): string {
  const base = env.APP_URL;
  const wrapped = html.replace(
    /(<a\s+[^>]*?href=["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi,
    (_m, pre: string, href: string, post: string) => {
      const wrappedUrl = `${base}/api/track/click/${trackingPixelId}?url=${encodeURIComponent(href)}`;
      return `${pre}${wrappedUrl}${post}`;
    },
  );
  const pixel = `<img src="${base}/api/track/open/${trackingPixelId}" alt="" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none" />`;
  // If body already has a </body>, inject just before. Otherwise append.
  if (/<\/body>/i.test(wrapped)) {
    return wrapped.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${wrapped}\n${pixel}`;
}

/**
 * Simple plain-text → HTML conversion used when a user's pitch body is
 * plain text (our composer lets them write either). Escapes HTML and
 * wraps paragraphs.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  return `<!doctype html><html><body>${paragraphs}</body></html>`;
}
