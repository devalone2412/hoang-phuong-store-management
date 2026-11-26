import { describe, expect, it } from "vitest";
import { normalizeVi, searchTerms } from "./text";

describe("normalizeVi", () => {
  it("strips Vietnamese diacritics", () => {
    expect(normalizeVi("Nước mắm Nam Ngư")).toBe("nuoc mam nam ngu");
    expect(normalizeVi("Ắ ằ ẳ ẵ ặ ộ ữ")).toBe("a a a a a o u");
  });
  it("maps đ/Đ to d", () => {
    expect(normalizeVi("Đường")).toBe("duong");
    expect(normalizeVi("đá")).toBe("da");
  });
  it("collapses whitespace and trims", () => {
    expect(normalizeVi("  Sữa   tươi  ")).toBe("sua tuoi");
  });
  it("is idempotent", () => {
    const once = normalizeVi("Bột giặt OMO");
    expect(normalizeVi(once)).toBe(once);
  });
});

describe("searchTerms", () => {
  it("splits into normalised words", () => {
    expect(searchTerms("Nước  mắm")).toEqual(["nuoc", "mam"]);
  });
  it("returns an empty list for blank input", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});
