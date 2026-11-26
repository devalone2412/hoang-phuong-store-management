import { defineConfig } from "drizzle-kit";

// Used only to generate SQL migrations. They are applied to D1 with `cf d1 migrations apply`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./migrations",
});
