import { env, waitUntil } from "cloudflare:workers";
import { getDb } from "@/db/client";
import { productInputSchema, thumbKey } from "@/features/products/schema";
import { handler, jsonError, readJson } from "@/server/http";
import { getProduct, softDeleteProduct, updateProduct } from "@/server/products.repo";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => jsonError(404, "not_found", "Không tìm thấy sản phẩm");

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const p = await getProduct(getDb(), (await params).id);
  return p ? Response.json(p) : notFound();
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const data = productInputSchema.parse(await readJson(req));
  const res = await updateProduct(getDb(), (await params).id, data);
  if (!res) return notFound();
  // Drop the replaced/removed image and its thumbnail from R2 after responding (best effort;
  // a leftover object is harmless).
  const old = res.previousImageKey;
  if (old && old !== res.product.imageKey) {
    waitUntil(env.IMAGES.delete([old, thumbKey(old)]).catch(() => {}));
  }
  return Response.json(res.product);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const ok = await softDeleteProduct(getDb(), (await params).id);
  return ok ? Response.json({ ok: true }) : notFound();
});
