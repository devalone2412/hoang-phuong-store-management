import { describe, expect, it } from "vitest";
import { bestPrice, under1kgPrice, weightPrice, weightRate } from "./pricing";

describe("bestPrice", () => {
  it("is quantity × price without combos", () => {
    expect(bestPrice(5000, [], 4)).toEqual({ total: 20000, parts: [{ quantity: 1, price: 5000, count: 4, kind: "single" }] });
  });

  it("is zero for zero units", () => {
    expect(bestPrice(5000, [{ quantity: 3, price: 12000 }], 0)).toEqual({ total: 0, parts: [] });
  });

  it("mixes combos and singles", () => {
    const r = bestPrice(5000, [{ quantity: 3, price: 12000 }], 7);
    expect(r.total).toBe(2 * 12000 + 5000);
    expect(r.parts).toEqual([
      { quantity: 3, price: 12000, count: 2, kind: "combo" },
      { quantity: 1, price: 5000, count: 1, kind: "single" },
    ]);
  });

  it("prefers the cheaper mix over a greedy largest-first choice", () => {
    // Largest-first would take 5 for 9.000 + 1 single (11.000); 2 × 3 for 4.000 is cheaper (8.000).
    const combos = [
      { quantity: 3, price: 4000 },
      { quantity: 5, price: 9000 },
    ];
    expect(bestPrice(2000, combos, 6).total).toBe(8000);
  });

  it("ignores a combo that is dearer than buying singly", () => {
    const r = bestPrice(1000, [{ quantity: 3, price: 3500 }], 3);
    expect(r.total).toBe(3000);
    expect(r.parts[0].kind).toBe("single");
  });
});

describe("weightPrice", () => {
  const kgOnly = (retailPrice: number) => ({ retailPrice });

  it("is price × weight for round amounts", () => {
    expect(weightPrice(kgOnly(40000), 1200)).toBe(48000);
    expect(weightPrice(kgOnly(40000), 100)).toBe(4000);
    expect(weightPrice(kgOnly(40000), 1000)).toBe(40000);
  });

  it("rounds to the nearest 500", () => {
    expect(weightPrice(kgOnly(37500), 130)).toBe(5000); // 4.875
    expect(weightPrice(kgOnly(37500), 110)).toBe(4000); // 4.125
    expect(weightPrice(kgOnly(37500), 120)).toBe(4500); // 4.500
  });

  it("never charges less than 500 for a positive weight, and nothing for none", () => {
    expect(weightPrice(kgOnly(10000), 5)).toBe(500);
    expect(weightPrice(kgOnly(40000), 0)).toBe(0);
    expect(weightPrice(kgOnly(40000), Number.NaN)).toBe(0);
  });

  describe("with a 100 g price", () => {
    const p = { retailPrice: 120000, price100g: 15000 };

    it("charges the 100 g rate under 1 kg", () => {
      expect(weightPrice(p, 100)).toBe(15000);
      expect(weightPrice(p, 130)).toBe(19500);
      expect(weightPrice(p, 300)).toBe(45000);
      expect(weightPrice(p, 900)).toBe(135000);
      expect(weightPrice(p, 999)).toBe(150000); // 149.850 -> 150.000
    });

    it("charges the kg price from 1 kg up", () => {
      expect(weightPrice(p, 1000)).toBe(120000);
      expect(weightPrice(p, 1500)).toBe(180000);
    });

    it("treats a missing or null 100 g price as plain per kg", () => {
      expect(weightPrice({ retailPrice: 120000, price100g: null }, 300)).toBe(weightPrice(kgOnly(120000), 300));
    });
  });
});

describe("weightRate", () => {
  const p = { retailPrice: 120000, price100g: 15000 };

  it("names the rate used and the exact amount", () => {
    expect(weightRate(p, 130)).toEqual({ per: "100g", price: 15000, exact: 19500 });
    expect(weightRate(p, 1000)).toEqual({ per: "kg", price: 120000, exact: 120000 });
    expect(weightRate(p, 1500)).toEqual({ per: "kg", price: 120000, exact: 180000 });
  });

  it("uses the kg rate under 1 kg when there is no 100 g price", () => {
    expect(weightRate({ retailPrice: 120000 }, 130)).toEqual({ per: "kg", price: 120000, exact: 15600 });
  });
});

describe("under1kgPrice", () => {
  it("is the admin's 100 g price, else the kg price ÷ 10", () => {
    expect(under1kgPrice({ retailPrice: 120000, price100g: 15000 })).toBe(15000);
    expect(under1kgPrice({ retailPrice: 120000, price100g: null })).toBe(12000);
    expect(under1kgPrice({ retailPrice: 37555 })).toBe(3756);
  });
});
