import { z } from "zod";
import { getDb } from "@/db/client";
import { handler } from "@/server/http";
import { lookupProducts } from "@/server/products.repo";

const querySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = handler(async (req: Request) => {
  const { q, page, pageSize } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await lookupProducts(getDb(), q, { page, pageSize }));
});
