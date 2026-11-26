import { getDb } from "@/db/client";
import { handler } from "@/server/http";
import { productMeta } from "@/server/products.repo";

export const GET = handler(async () => Response.json(await productMeta(getDb())));
