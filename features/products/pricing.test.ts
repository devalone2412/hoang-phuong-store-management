import { describe, expect, it } from "vitest";
import { bestPrice, weightPrice } from "./pricing";

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
  it("is price × weight for round amounts", () => {
    expect(weightPrice(40000, 1200)).toBe(48000);
    expect(weightPrice(40000, 100)).toBe(4000);
    expect(weightPrice(40000, 1000)).toBe(40000);
  });

  it("rounds to the nearest 500", () => {
    expect(weightPrice(37500, 130)).toBe(5000); // 4.875
    expect(weightPrice(37500, 110)).toBe(4000); // 4.125
    expect(weightPrice(37500, 120)).toBe(4500); // 4.500
  });

  it("never charges less than 500 for a positive weight, and nothing for none", () => {
    expect(weightPrice(10000, 5)).toBe(500);
    expect(weightPrice(40000, 0)).toBe(0);
    expect(weightPrice(40000, Number.NaN)).toBe(0);
  });

  describe("with weight price points", () => {
    const pts = [
      { grams: 100, price: 15000 },
      { grams: 200, price: 28000 },
      { grams: 500, price: 65000 },
    ];

    it("is unchanged without points", () => {
      expect(weightPrice(120000, 300, [])).toBe(weightPrice(120000, 300));
    });

    it("hits a point exactly", () => {
      expect(weightPrice(120000, 100, pts)).toBe(15000);
      expect(weightPrice(120000, 200, pts)).toBe(28000);
      expect(weightPrice(120000, 500, pts)).toBe(65000);
    });

    it("below 1 kg uses the rate of the heaviest point not above the weight", () => {
      expect(weightPrice(120000, 300, pts)).toBe(42000); // 200 g rate: 140/g
      expect(weightPrice(120000, 999, pts)).toBe(130000); // 500 g rate: 130/g
      expect(weightPrice(120000, 50, pts)).toBe(7500); // below the lightest: 150/g
    });

    it("with only a 100 g point, everything under 1 kg uses its rate", () => {
      const one = [{ grams: 100, price: 15000 }];
      expect(weightPrice(120000, 130, one)).toBe(19500);
      expect(weightPrice(120000, 900, one)).toBe(135000);
    });

    it("from 1 kg up only the 1 kg price applies", () => {
      expect(weightPrice(120000, 1000, pts)).toBe(120000);
      expect(weightPrice(120000, 1500, pts)).toBe(180000);
      expect(weightPrice(120000, 1000, [{ grams: 100, price: 15000 }])).toBe(120000);
    });
  });
});
