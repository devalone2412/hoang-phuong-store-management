import { z } from "zod";
import { getDb } from "@/db/client";
import { handler, readJson } from "@/server/http";
import { bulkSoftDelete } from "@/server/products.repo";

const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

export const POST = handler(async (req: Request) => {
  const { ids } = bodySchema.parse(await readJson(req));
  return Response.json({ deleted: await bulkSoftDelete(getDb(), ids) });
});
