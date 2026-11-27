import { describe, expect, it } from "vitest";
import { formatWeight, parseWeight, weightInputText } from "./weight";

describe("parseWeight", () => {
  it.each([
    ["1,2kg", 1200],
    ["1.2kg", 1200],
    ["1,2", 1200],
    ["0.5", 500],
    ["2", 2000],
    ["100g", 100],
    ["100 gram", 100],
    ["100gr", 100],
    ["500 g", 500],
    ["300", 300],
    ["49", 49_000],
    ["50", 50],
    ["50kg", 50_000],
    ["0,25 kg", 250],
    [" 1 KG ", 1000],
  ])("%s -> %d", (input, grams) => expect(parseWeight(input)).toBe(grams));

  it("returns null for empty input", () => {
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("   ")).toBeNull();
  });

  it.each(["abc", "1kg2", "0", "0g", "-5", "1,2,3", "1000kg", "1.5.2"])("rejects %s", (input) =>
    expect(parseWeight(input)).toBeNaN(),
  );
});

describe("formatWeight", () => {
  it("uses grams below 1 kg and kg from 1 kg up", () => {
    expect(formatWeight(300)).toBe("300 g");
    expect(formatWeight(1000)).toBe("1 kg");
    expect(formatWeight(1200)).toBe("1,2 kg");
    expect(formatWeight(1250)).toBe("1,25 kg");
  });
  it("round-trips through the input text", () => {
    for (const g of [100, 300, 1000, 1200, 2500]) expect(parseWeight(weightInputText(g))).toBe(g);
  });
});
