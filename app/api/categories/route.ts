import { getDb } from "@/db/client";
import { categoryInputSchema } from "@/features/categories/schema";
import { createCategory, listCategories } from "@/server/categories.repo";
import { handler, readJson, staffHandler } from "@/server/http";

/** Staff read the list too: Tra giá filters by group. */
export const GET = staffHandler(async () => Response.json({ items: await listCategories(getDb()) }));

export const POST = handler(async (req: Request) => {
  const { name } = categoryInputSchema.parse(await readJson(req));
  return Response.json(await createCategory(getDb(), name), { status: 201 });
});
