import { describe, expect, it } from "vitest";
import { comboWarnings, priceWarnings, productInputSchema, weightPriceWarnings } from "./schema";

const valid = { name: "Nước mắm Nam Ngư 500ml", unit: "chai", retailPrice: 38000 };

describe("productInputSchema", () => {
  it("accepts a minimal product and nulls the optionals", () => {
    const r = productInputSchema.parse(valid);
    expect(r.costPrice).toBeNull();
    expect(r.sku).toBeNull();
    expect(r.barcodes).toEqual([]);
  });

  it("keeps several barcodes in order, trimmed", () => {
    const r = productInputSchema.parse({ ...valid, barcodes: [" 8934563138165 ", "8934563138172"] });
    expect(r.barcodes).toEqual(["8934563138165", "8934563138172"]);
  });

  it("rejects duplicate, blank and too many barcodes", () => {
    expect(productInputSchema.safeParse({ ...valid, barcodes: ["1", "1"] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, barcodes: ["  "] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, barcodes: Array.from({ length: 11 }, (_, i) => String(i)) }).success).toBe(false);
  });

  it("trims names and turns blank optionals into null", () => {
    const r = productInputSchema.parse({ ...valid, name: "  Gạo ST25  ", sku: "   ", note: "" });
    expect(r.name).toBe("Gạo ST25");
    expect(r.sku).toBeNull();
    expect(r.note).toBeNull();
  });

  it("rejects an empty name, missing unit and negative or fractional prices", () => {
    expect(productInputSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, unit: "" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, retailPrice: -1 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, retailPrice: 10.5 }).success).toBe(false);
  });

});

describe("priceWarnings", () => {
  it("warns when cost > retail", () => {
    expect(priceWarnings({ retailPrice: 100, costPrice: 120 })).toHaveLength(1);
  });
  it("is quiet for sensible prices", () => {
    expect(priceWarnings({ retailPrice: 100, costPrice: 70 })).toEqual([]);
  });
});

describe("combos and image", () => {
  it("defaults to no combos and no image", () => {
    const r = productInputSchema.parse(valid);
    expect(r.combos).toEqual([]);
    expect(r.imageKey).toBeNull();
  });

  it("sorts combos by quantity", () => {
    const r = productInputSchema.parse({ ...valid, combos: [{ quantity: 10, price: 90000 }, { quantity: 3, price: 30000 }] });
    expect(r.combos.map((c) => c.quantity)).toEqual([3, 10]);
  });

  it("rejects duplicate quantities, quantity < 2 and too many combos", () => {
    const dup = [{ quantity: 3, price: 1 }, { quantity: 3, price: 2 }];
    expect(productInputSchema.safeParse({ ...valid, combos: dup }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, combos: [{ quantity: 1, price: 1 }] }).success).toBe(false);
    const many = Array.from({ length: 6 }, (_, i) => ({ quantity: i + 2, price: 1000 }));
    expect(productInputSchema.safeParse({ ...valid, combos: many }).success).toBe(false);
  });

  it("only accepts keys shaped like the ones the upload route generates", () => {
    const key = "3067893f-fc81-4e00-b301-1d0676a003a4.webp";
    expect(productInputSchema.parse({ ...valid, imageKey: key }).imageKey).toBe(key);
    expect(productInputSchema.safeParse({ ...valid, imageKey: "../secret.webp" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, imageKey: "abc.gif" }).success).toBe(false);
  });

  it("warns when a combo is not cheaper than buying singly", () => {
    expect(comboWarnings(5000, [{ quantity: 3, price: 15000 }])).toHaveLength(1);
    expect(comboWarnings(5000, [{ quantity: 3, price: 12000 }])).toEqual([]);
  });

  describe("sold by weight", () => {
    it("forces the unit to kg, even when none is sent", () => {
      const { unit: _unit, ...noUnit } = valid;
      const r = productInputSchema.parse({ ...noUnit, soldByWeight: true });
      expect(r.soldByWeight).toBe(true);
      expect(r.unit).toBe("kg");
      expect(productInputSchema.parse({ ...valid, soldByWeight: true, unit: "bao" }).unit).toBe("kg");
    });

    it("rejects combos", () => {
      const r = productInputSchema.safeParse({ ...valid, soldByWeight: true, combos: [{ quantity: 2, price: 50000 }] });
      expect(r.success).toBe(false);
    });

    it("still requires a unit for everything else", () => {
      const { unit: _unit, ...noUnit } = valid;
      const r = productInputSchema.safeParse(noUnit);
      expect(r.success).toBe(false);
      expect(productInputSchema.parse(valid).soldByWeight).toBe(false);
    });

    describe("weight prices", () => {
      const w = { ...valid, soldByWeight: true, retailPrice: 120000 };

      it("sorts rows by weight and defaults to none", () => {
        expect(productInputSchema.parse(w).weightPrices).toEqual([]);
        const r = productInputSchema.parse({
          ...w,
          weightPrices: [
            { grams: 500, price: 65000 },
            { grams: 100, price: 15000 },
          ],
        });
        expect(r.weightPrices.map((x) => x.grams)).toEqual([100, 500]);
      });

      it("rejects rows on a product not sold by weight", () => {
        expect(productInputSchema.safeParse({ ...valid, weightPrices: [{ grams: 100, price: 15000 }] }).success).toBe(false);
      });

      it("rejects duplicate weights and a 1 kg row", () => {
        const dup = [
          { grams: 100, price: 15000 },
          { grams: 100, price: 16000 },
        ];
        expect(productInputSchema.safeParse({ ...w, weightPrices: dup }).success).toBe(false);
        expect(productInputSchema.safeParse({ ...w, weightPrices: [{ grams: 1000, price: 120000 }] }).success).toBe(false);
      });

      it("allows at most 5 rows", () => {
        const rows = [100, 200, 300, 400, 500, 600].map((grams) => ({ grams, price: grams * 150 }));
        expect(productInputSchema.safeParse({ ...w, weightPrices: rows }).success).toBe(false);
      });
    });
  });

  describe("weightPriceWarnings", () => {
    it("is quiet for sensible rows", () => {
      expect(
        weightPriceWarnings(120000, [
          { grams: 100, price: 15000 },
          { grams: 500, price: 65000 },
        ]),
      ).toEqual([]);
    });

    it("flags a heavier weight that costs less", () => {
      expect(
        weightPriceWarnings(120000, [
          { grams: 200, price: 28000 },
          { grams: 500, price: 20000 },
        ]).some((m) => m.includes("500 g rẻ hơn 200 g")),
      ).toBe(true);
    });

    it("flags a row cheaper per kg than 1 kg", () => {
      expect(weightPriceWarnings(120000, [{ grams: 100, price: 10000 }])).toHaveLength(1);
    });
  });
});
