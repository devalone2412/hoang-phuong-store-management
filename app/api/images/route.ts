import { env } from "cloudflare:workers";
import { thumbKey } from "@/features/products/schema";
import { handler, jsonError } from "@/server/http";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_THUMB_BYTES = 200 * 1024;

/** Identify by magic bytes, not by the client-supplied type. */
function sniff(b: Uint8Array): { ext: "jpg" | "png" | "webp"; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  const riff = String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return riff ? { ext: "webp", type: "image/webp" } : null;
}

export const POST = handler(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "invalid", "Chưa chọn ảnh");
  if (file.size > MAX_BYTES) return jsonError(413, "too_large", "Ảnh quá lớn (tối đa 5MB)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return jsonError(415, "unsupported", "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP");

  const key = `${crypto.randomUUID()}.${kind.ext}`;
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind.type } });

  // Optional small copy for lists. Best effort: without it the UI falls back to the full image.
  const thumb = form?.get("thumb");
  if (thumb instanceof File && thumb.size <= MAX_THUMB_BYTES) {
    const tb = new Uint8Array(await thumb.arrayBuffer());
    if (sniff(tb)?.ext === "webp") {
      await env.IMAGES.put(thumbKey(key), tb, { httpMetadata: { contentType: "image/webp" } }).catch(() => {});
    }
  }
  return Response.json({ key }, { status: 201 });
});
