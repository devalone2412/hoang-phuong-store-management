import { describe, expect, it } from "vitest";
import { formatDateTime, formatVnd, margin, parseVnd } from "./money";

describe("parseVnd", () => {
  it.each([
    ["15000", 15000],
    ["15.000", 15000],
    ["15,000", 15000],
    ["1.234.567", 1234567],
    ["15k", 15000],
    ["15K", 15000],
    ["1.2tr", 1200000],
    ["1,2tr", 1200000],
    ["2tr", 2000000],
    ["12.500 ₫", 12500],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parseVnd(input)).toBe(expected);
  });

  it("returns null for empty input", () => {
    expect(parseVnd("")).toBeNull();
    expect(parseVnd("  ")).toBeNull();
  });

  it.each(["abc", "12.5", "1..2", "k"])("returns NaN for %s", (input) => {
    expect(parseVnd(input)).toBeNaN();
  });
});

describe("formatVnd", () => {
  it("formats with vi-VN grouping", () => {
    expect(formatVnd(15000).replace(/\s/g, " ")).toBe("15.000 ₫");
    expect(formatVnd(1200000).replace(/\s/g, " ")).toBe("1.200.000 ₫");
  });
  it("shows a dash for missing values", () => {
    expect(formatVnd(null)).toBe("—");
  });
});

describe("margin", () => {
  it("computes amount and percent of retail", () => {
    expect(margin(20000, 17000)).toEqual({ amount: 3000, percent: 15 });
  });
  it("can be negative", () => {
    expect(margin(10000, 12000)?.amount).toBe(-2000);
  });
  it("is null without a cost", () => {
    expect(margin(10000, null)).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("formats in Vietnam time", () => {
    // 2023-11-14T22:13:20Z is 05:13 the next day in UTC+7.
    expect(formatDateTime(1_700_000_000_000)).toBe("15/11/2023 05:13");
  });
});
