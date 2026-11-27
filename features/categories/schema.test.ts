import { describe, expect, it } from "vitest";
import { categoryInputSchema, categoryKey } from "./schema";

describe("categoryInputSchema", () => {
  it("trims the name", () => {
    expect(categoryInputSchema.parse({ name: "  Gạo  " }).name).toBe("Gạo");
  });
  it("rejects blank and over-long names", () => {
    expect(categoryInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
    expect(categoryInputSchema.safeParse({}).success).toBe(false);
  });

  it("collapses inner whitespace", () => {
    expect(categoryInputSchema.parse({ name: "Mì   gói" }).name).toBe("Mì gói");
  });

  it("keys ignore case, including Vietnamese capitals that SQLite's lower() misses", () => {
    expect(categoryKey("GẠO")).toBe(categoryKey("Gạo"));
    expect(categoryKey("  Mì  GÓI ")).toBe(categoryKey("mì gói"));
    expect(categoryKey("Gạo")).not.toBe(categoryKey("Gao"));
  });
});
