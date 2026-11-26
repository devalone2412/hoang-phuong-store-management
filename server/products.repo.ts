import { and, asc, desc, eq, getTableColumns, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { productBarcodes, products, type ProductRow } from "@/db/schema";
import type { ListQuery, Product, ProductData } from "@/features/products/schema";
import { normalizeVi, searchTerms } from "@/lib/text";

export class ConflictError extends Error {
  constructor(
    public field: "sku" | "barcodes",
    message: string,
  ) {
    super(message);
  }
}

export function toProduct(r: ProductRow, barcodes: string[]): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcodes,
    unit: r.unit,
    category: r.category,
    retailPrice: r.retailPrice,
    wholesalePrice: r.wholesalePrice,
    costPrice: r.costPrice,
    combos: r.combos ?? [],
    imageKey: r.imageKey,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Product columns plus its live barcodes (primary first) as a JSON array, read in the same query so
 * a read never needs a second D1 round trip.
 */
const productSelect = {
  ...getTableColumns(products),
  barcodes: sql<string>`(SELECT json_group_array(b.barcode) FROM (SELECT ${productBarcodes.barcode} AS barcode FROM ${productBarcodes} WHERE ${productBarcodes.productId} = ${products.id} AND ${productBarcodes.deletedAt} IS NULL ORDER BY ${productBarcodes.position}) b)`.as(
    "barcodes",
  ),
};

type ProductWithCodes = ProductRow & { barcodes: string };

function fromRow({ barcodes, ...row }: ProductWithCodes): Product {
  return toProduct(row, JSON.parse(barcodes) as string[]);
}

const barcodeRows = (productId: string, barcodes: string[]) =>
  barcodes.map((barcode, position) => ({ productId, barcode, position, deletedAt: null }));

/** Escape LIKE wildcards so user input is matched literally. */
function likePattern(term: string, mode: "contains" | "prefix" = "contains") {
  const esc = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  return mode === "prefix" ? `${esc}%` : `%${esc}%`;
}

/** Every search word must match the name (accent-insensitive), SKU or barcode. */
function searchWhere(q: string): SQL | undefined {
  const terms = searchTerms(q);
  if (terms.length === 0) return undefined;
  return and(
    ...terms.map((t) => {
      const p = likePattern(t);
      return or(
        sql`${products.nameSearch} LIKE ${p} ESCAPE '\\'`,
        sql`lower(${products.sku}) LIKE ${p} ESCAPE '\\'`,
        sql`EXISTS (SELECT 1 FROM ${productBarcodes} WHERE ${productBarcodes.productId} = ${products.id} AND ${productBarcodes.deletedAt} IS NULL AND ${productBarcodes.barcode} LIKE ${p} ESCAPE '\\')`,
      );
    }),
  );
}

function rethrowConflict(e: unknown): never {
  const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
  if (msg.includes("products_sku_uq") || msg.includes("products.sku")) {
    throw new ConflictError("sku", "SKU này đã được dùng cho sản phẩm khác");
  }
  if (msg.includes("product_barcodes_barcode_uq") || msg.includes("product_barcodes.barcode")) {
    throw new ConflictError("barcodes", "Có mã vạch đã được dùng cho sản phẩm khác");
  }
  throw e;
}

export async function listProducts(db: Db, query: ListQuery) {
  const where = and(
    isNull(products.deletedAt),
    query.category ? eq(products.category, query.category) : undefined,
    searchWhere(query.q),
  );

  const sortCol =
    query.sort === "name"
      ? products.nameSearch
      : query.sort === "retailPrice"
        ? products.retailPrice
        : products.updatedAt;
  const order = query.dir === "asc" ? asc(sortCol) : desc(sortCol);

  // One batch = one round trip to D1.
  const [rows, [{ total }]] = await db.batch([
    db
      .select(productSelect)
      .from(products)
      .where(where)
      .orderBy(order, asc(products.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: sql<number>`count(*)` }).from(products).where(where),
  ]);

  return {
    items: rows.map(fromRow),
    total: Number(total),
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Quick price lookup, paginated. An exact barcode/SKU hit is returned as `exact` (page 1 only)
 * so the UI can pin its price card (barcode scanners type the code then press Enter).
 */
export async function lookupProducts(db: Db, rawQuery: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const q = rawQuery.trim();
  if (!q) return { exact: null, items: [] as Product[], total: 0, page, pageSize };

  const terms = searchTerms(q);
  const first = terms[0] ?? "";
  const where = and(isNull(products.deletedAt), searchWhere(q));

  const [rows, [{ total }], exactRows] = await db.batch([
    db
      .select(productSelect)
      .from(products)
      .where(where)
      .orderBy(
        sql`CASE WHEN ${products.nameSearch} LIKE ${likePattern(first, "prefix")} ESCAPE '\\' THEN 0 ELSE 1 END`,
        asc(products.nameSearch),
        asc(products.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)` }).from(products).where(where),
    // Only page 1 pins an exact hit; other pages run a cheap no-op so the batch keeps one shape.
    exactQuery(db, page === 1 ? q : null),
  ]);

  const exact = exactRows[0] ? fromRow(exactRows[0]) : null;
  return { exact, items: rows.map(fromRow).filter((p) => p.id !== exact?.id), total: Number(total), page, pageSize };
}

function exactQuery(db: Db, code: string | null) {
  return db
    .select(productSelect)
    .from(products)
    .where(
      code === null
        ? sql`0`
        : and(
            isNull(products.deletedAt),
            or(
              inArray(
                products.id,
                db
                  .select({ id: productBarcodes.productId })
                  .from(productBarcodes)
                  .where(and(eq(productBarcodes.barcode, code), isNull(productBarcodes.deletedAt))),
              ),
              sql`lower(${products.sku}) = lower(${code})`,
            ),
          ),
    )
    .limit(1);
}

/** Exact barcode / SKU hit only (checkout scans): one query, one round trip. */
export async function findByCode(db: Db, code: string) {
  const [row] = await exactQuery(db, code.trim());
  return row ? fromRow(row) : null;
}

export async function getProduct(db: Db, id: string) {
  const [row] = await db
    .select(productSelect)
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);
  return row ? fromRow(row) : null;
}

/** Everything except the barcodes, which live in their own table. */
function productColumns(data: ProductData) {
  return {
    name: data.name,
    nameSearch: normalizeVi(data.name),
    sku: data.sku,
    unit: data.unit,
    category: data.category,
    retailPrice: data.retailPrice,
    wholesalePrice: data.wholesalePrice,
    costPrice: data.costPrice,
    combos: data.combos,
    imageKey: data.imageKey,
    note: data.note,
  };
}

export async function createProduct(db: Db, data: ProductData) {
  const now = Date.now();
  const row = {
    id: crypto.randomUUID(),
    ...productColumns(data),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  try {
    // One D1 batch is one transaction: a duplicate barcode leaves no half-created product.
    const stmts = [db.insert(products).values(row), ...(data.barcodes.length ? [db.insert(productBarcodes).values(barcodeRows(row.id, data.barcodes))] : [])];
    await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  } catch (e) {
    rethrowConflict(e);
  }
  return toProduct(row, data.barcodes);
}

/** Returns the updated product and the image key it had before (so the caller can clean up R2). */
export async function updateProduct(db: Db, id: string, data: ProductData) {
  const [live] = await db
    .select({ id: products.id, imageKey: products.imageKey })
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);
  if (!live) return null;
  try {
    // Replace the barcode set and update the product atomically (see createProduct).
    const stmts = [
      db.delete(productBarcodes).where(eq(productBarcodes.productId, id)),
      ...(data.barcodes.length ? [db.insert(productBarcodes).values(barcodeRows(id, data.barcodes))] : []),
      db
        .update(products)
        .set({ ...productColumns(data), updatedAt: Date.now() })
        .where(eq(products.id, id))
        .returning(),
    ];
    const results = await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
    const [row] = results[results.length - 1] as ProductRow[];
    return row ? { product: toProduct(row, data.barcodes), previousImageKey: live.imageKey } : null;
  } catch (e) {
    rethrowConflict(e);
  }
}

export async function softDeleteProduct(db: Db, id: string) {
  const now = Date.now();
  // Barcodes are released in the same transaction, so a deleted product never holds a code.
  const [, res] = await db.batch([
    db.update(productBarcodes).set({ deletedAt: now }).where(and(eq(productBarcodes.productId, id), isNull(productBarcodes.deletedAt))),
    db
      .update(products)
      .set({ deletedAt: now })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning({ id: products.id }),
  ]);
  return (res as unknown[]).length > 0;
}

/** Undo a delete. Fails with ConflictError if the SKU/barcode was reused meanwhile. */
export async function restoreProduct(db: Db, id: string) {
  try {
    const [, restored, reread] = await db.batch([
      db.update(productBarcodes).set({ deletedAt: null }).where(eq(productBarcodes.productId, id)),
      db
        .update(products)
        .set({ deletedAt: null, updatedAt: Date.now() })
        .where(and(eq(products.id, id), isNotNull(products.deletedAt)))
        .returning({ id: products.id }),
      db.select(productSelect).from(products).where(eq(products.id, id)).limit(1),
    ]);
    return restored.length > 0 && reread[0] ? fromRow(reread[0]) : null;
  } catch (e) {
    rethrowConflict(e);
  }
}

export async function bulkSoftDelete(db: Db, ids: string[]) {
  if (ids.length === 0) return [] as string[];
  const now = Date.now();
  const deleted: string[] = [];
  // D1 limits bound parameters per statement, so work in chunks.
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const [, res] = await db.batch([
      db.update(productBarcodes).set({ deletedAt: now }).where(and(isNull(productBarcodes.deletedAt), inArray(productBarcodes.productId, chunk))),
      db
        .update(products)
        .set({ deletedAt: now })
        .where(and(isNull(products.deletedAt), inArray(products.id, chunk)))
        .returning({ id: products.id }),
    ]);
    const gone = (res as { id: string }[]).map((r) => r.id);
    deleted.push(...gone);
  }
  return deleted;
}

/** Distinct units and categories, used by the form comboboxes and the category filter. */
export async function productMeta(db: Db) {
  const [units, categories] = await Promise.all([
    db
      .selectDistinct({ v: products.unit })
      .from(products)
      .where(isNull(products.deletedAt))
      .orderBy(asc(products.unit)),
    db
      .selectDistinct({ v: products.category })
      .from(products)
      .where(and(isNull(products.deletedAt), isNotNull(products.category)))
      .orderBy(asc(products.category)),
  ]);
  return {
    units: units.map((u) => u.v),
    categories: categories.map((c) => c.v).filter((v): v is string => !!v),
  };
}
