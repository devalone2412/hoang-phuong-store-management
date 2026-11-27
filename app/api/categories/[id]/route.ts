import { getDb } from "@/db/client";
import { categoryInputSchema } from "@/features/categories/schema";
import { deleteCategory, renameCategory } from "@/server/categories.repo";
import { handler, jsonError, readJson } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => jsonError(404, "not_found", "Không tìm thấy nhóm hàng");

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { name } = categoryInputSchema.parse(await readJson(req));
  const res = await renameCategory(getDb(), (await params).id, name);
  return res ? Response.json(res) : notFound();
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const affected = await deleteCategory(getDb(), (await params).id);
  return affected === null ? notFound() : Response.json({ ok: true, affected });
});
