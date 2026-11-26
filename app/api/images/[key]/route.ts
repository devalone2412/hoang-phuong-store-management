import { env } from "cloudflare:workers";
import { IMAGE_KEY_RE, THUMB_KEY_RE } from "@/features/products/schema";
import { handler, jsonError } from "@/server/http";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ key: string }> }) => {
  const { key } = await params;
  if (!IMAGE_KEY_RE.test(key) && !THUMB_KEY_RE.test(key)) return jsonError(404, "not_found", "Không tìm thấy ảnh");
  const obj = await env.IMAGES.get(key);
  if (!obj) {
    // Older images have no thumbnail; let the browser remember that instead of asking every render.
    return THUMB_KEY_RE.test(key)
      ? new Response(null, { status: 404, headers: { "cache-control": "private, max-age=3600" } })
      : jsonError(404, "not_found", "Không tìm thấy ảnh");
  }
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      // Keys are random and never reused, so the bytes behind a key never change.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
});
