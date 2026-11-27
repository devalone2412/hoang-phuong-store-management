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
    /** Sold by weight: `retailPrice` is per kg and the unit is always kg. */
    soldByWeight: integer("sold_by_weight", { mode: "boolean" }).notNull().default(false),
    /** All prices are whole VND. */
    retailPrice: integer("retail_price").notNull(),
    costPrice: integer("cost_price"),
    /** Quantity deals, e.g. 3 packs for 20.000. */
    combos: text("combos", { mode: "json" }).$type<{ quantity: number; price: number }[]>(),
    /** Weighed products only: fixed prices for smaller weights, e.g. 100 g = 15.000. 1 kg is `retailPrice`. */
    weightPrices: text("weight_prices", { mode: "json" }).$type<{ grams: number; price: number }[]>(),
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

/** Admin-managed product groups ("Nhóm hàng"). Products reference one by name (`products.category`). */
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** `categoryKey(name)`: Unicode-lowercased, so "Gạo" and "GẠO" collide (SQLite's lower() is ASCII-only). */
    nameKey: text("name_key").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("categories_name_key_uq").on(t.nameKey)],
);

export type CategoryRow = typeof categories.$inferSelect;

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

/** Non-admin logins (store staff). The admin is not a row here: it comes from the ADMIN_* secrets. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Lowercase; unique. */
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  /** `pbkdf2$100000$<saltB64>$<hashB64>`, see server/password.ts. */
  passwordHash: text("password_hash").notNull(),
  avatarKey: text("avatar_key"),
  /** Bumped on password reset / lock; sessions carrying an older value stop working. */
  sessionVersion: integer("session_version").notNull().default(1),
  disabledAt: integer("disabled_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
