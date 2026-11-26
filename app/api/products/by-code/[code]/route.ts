import { getDb } from "@/db/client";
import { handler, jsonError } from "@/server/http";
import { findByCode } from "@/server/products.repo";

/** Exact barcode / SKU hit for checkout scans: `{ product }` or 404. */
export const GET = handler(async (_req: Request, { params }: { params: Promise<{ code: string }> }) => {
  const code = decodeURIComponent((await params).code).trim().slice(0, 100);
  const product = code ? await findByCode(getDb(), code) : null;
  return product ? Response.json({ product }) : jsonError(404, "not_found", "Không tìm thấy sản phẩm");
});
