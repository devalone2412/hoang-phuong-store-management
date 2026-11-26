import { getDb } from "@/db/client";
import { handler, jsonError } from "@/server/http";
import { restoreProduct } from "@/server/products.repo";

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const p = await restoreProduct(getDb(), (await params).id);
  return p ? Response.json(p) : jsonError(404, "not_found", "Không tìm thấy sản phẩm đã xóa");
});
