import { env } from "cloudflare:workers";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

/** Per-request Drizzle client over the D1 binding (`DB` in cloudflare.config.ts). */
export function getDb(): Db {
  return drizzle(env.DB, { schema });
}
