import { getDb } from "@/db/client";
import { jsonError, staffHandler } from "@/server/http";
import { findByCode, forViewer } from "@/server/products.repo";

/** Exact barcode / SKU hit for checkout scans: `{ product }` or 404. */
export const GET = staffHandler(async (session, _req: Request, { params }: { params: Promise<{ code: string }> }) => {
  const code = decodeURIComponent((await params).code).trim().slice(0, 100);
  const product = code ? await findByCode(getDb(), code) : null;
  return product ? Response.json({ product: forViewer(product, session.role) }) : jsonError(404, "not_found", "Không tìm thấy sản phẩm");
});
