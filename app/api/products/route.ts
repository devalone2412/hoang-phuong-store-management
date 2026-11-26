import { getDb } from "@/db/client";
import { listQuerySchema, productInputSchema } from "@/features/products/schema";
import { handler, readJson } from "@/server/http";
import { createProduct, listProducts } from "@/server/products.repo";

export const GET = handler(async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = listQuerySchema.parse(params);
  return Response.json(await listProducts(getDb(), query));
});

export const POST = handler(async (req: Request) => {
  const data = productInputSchema.parse(await readJson(req));
  return Response.json(await createProduct(getDb(), data), { status: 201 });
});
