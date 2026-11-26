import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Lowercase, diacritics stripped, đ→d. Used for accent-insensitive search. */
    nameSearch: text("name_search").notNull(),
    sku: text("sku"),
    unit: text("unit").notNull(),
    category: text("category"),
    /** All prices are whole VND. */
    retailPrice: integer("retail_price").notNull(),
    wholesalePrice: integer("wholesale_price"),
    costPrice: integer("cost_price"),
    /** Quantity deals, e.g. 3 packs for 20.000. */
    combos: text("combos", { mode: "json" }).$type<{ quantity: number; price: number }[]>(),
    /** Object key in the IMAGES R2 bucket, e.g. `<uuid>.webp`. */
    imageKey: text("image_key"),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    // Unique among live products only, so a deleted product frees its SKU/barcode.
    uniqueIndex("products_sku_uq").on(t.sku).where(sql`${t.deletedAt} IS NULL`),
    // Serves the exact-SKU lookup (`lower(sku) = lower(?)`) used by scans.
    index("products_sku_lower_idx").on(sql`lower(${t.sku})`).where(sql`${t.deletedAt} IS NULL`),
    index("products_name_search_idx").on(t.nameSearch),
    index("products_updated_at_idx").on(t.updatedAt),
    index("products_category_idx").on(t.category),
  ],
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;

/**
 * A product can have several barcodes (different pack sizes, old/new packaging, supplier codes).
 * `deletedAt` mirrors the product's, so a deleted product frees its codes (unique among live
 * rows only) and restoring it claims them back. `position` 0 is the primary barcode.
 */
export const productBarcodes = sqliteTable(
  "product_barcodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    barcode: text("barcode").notNull(),
    position: integer("position").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    uniqueIndex("product_barcodes_barcode_uq").on(t.barcode).where(sql`${t.deletedAt} IS NULL`),
    index("product_barcodes_product_idx").on(t.productId),
  ],
);

export type NewBarcodeRow = typeof productBarcodes.$inferInsert;

/** Tiny key/value table for single-admin settings, e.g. `admin_avatar` -> an image key in the IMAGES bucket. */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at").notNull(),
});
