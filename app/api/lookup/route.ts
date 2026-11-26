import { z } from "zod";
import { getDb } from "@/db/client";
import { staffHandler } from "@/server/http";
import { forViewer, lookupProducts } from "@/server/products.repo";

const querySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = staffHandler(async (session, req: Request) => {
  const { q, page, pageSize } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const res = await lookupProducts(getDb(), q, { page, pageSize });
  return Response.json({
    ...res,
    exact: forViewer(res.exact, session.role),
    items: res.items.map((p) => forViewer(p, session.role)),
  });
});
