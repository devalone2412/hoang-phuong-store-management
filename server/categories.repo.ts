import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { categoryKey, type Category } from "@/features/categories/schema";
import { ConflictError } from "./products.repo";

const DUPLICATE = "Nhóm hàng đã tồn tại";

function rethrow(e: unknown): never {
  const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
  if (msg.includes("categories_name_key_uq") || msg.includes("categories.name_key")) throw new ConflictError("name", DUPLICATE);
  throw e;
}

/** Every category (A→Z, accent-aware) with how many live products use it. */
export async function listCategories(db: Db): Promise<Category[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      productCount: sql<number>`(SELECT count(*) FROM ${products} WHERE ${products.category} = ${sql.raw('"categories"."name"')} AND ${products.deletedAt} IS NULL)`,
    })
    .from(categories)
    .orderBy(sql`lower(${categories.name})`);
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

export async function createCategory(db: Db, name: string): Promise<Category> {
  const now = Date.now();
  const row = { id: crypto.randomUUID(), name, nameKey: categoryKey(name), createdAt: now, updatedAt: now };
  try {
    await db.insert(categories).values(row);
  } catch (e) {
    rethrow(e);
  }
  return { id: row.id, name, productCount: 0 };
}

/** Renames the category and every product (even deleted ones, so a restore stays consistent) using it. */
export async function renameCategory(db: Db, id: string, name: string): Promise<Category | null> {
  const [current] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!current) return null;
  try {
    // One batch = one transaction: a duplicate name leaves the products untouched.
    await db.batch([
      db.update(categories).set({ name, nameKey: categoryKey(name), updatedAt: Date.now() }).where(eq(categories.id, id)),
      db.update(products).set({ category: name }).where(eq(products.category, current.name)),
    ]);
  } catch (e) {
    rethrow(e);
  }
  const [row] = (await listCategories(db)).filter((c) => c.id === id);
  return row ?? null;
}

/** Deletes the category; its products stay but lose their group. Returns how many were affected. */
export async function deleteCategory(db: Db, id: string): Promise<number | null> {
  const [current] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!current) return null;
  const [count] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.category, current.name), isNull(products.deletedAt)));
  await db.batch([
    db.update(products).set({ category: null }).where(eq(products.category, current.name)),
    db.delete(categories).where(eq(categories.id, id)),
  ]);
  return Number(count?.n ?? 0);
}
