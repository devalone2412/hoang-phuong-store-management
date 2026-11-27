import type { Combo, WeightPrice } from "./schema";

export type PricePart = { quantity: number; price: number; count: number; kind: "combo" | "single" };

/**
 * Cheapest way to buy `qty` units: any mix of combo deals and single units at `unitPrice`.
 * E.g. combos 3 for 12.000 and 30 for 100.000, unit 5.000, qty 7 -> 2 × combo(3) + 1 single.
 * Exact (unbounded knapsack), so a cheaper combo is never skipped for a greedy one.
 */
export function bestPrice(unitPrice: number, combos: Combo[], qty: number): { total: number; parts: PricePart[] } {
  const n = Math.max(0, Math.floor(qty));
  const cost = new Array<number>(n + 1).fill(0);
  // Last step taken to reach i: 0 = one single unit, k>0 = combos[k-1].
  const step = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cost[i] = cost[i - 1] + unitPrice;
    step[i] = 0;
    combos.forEach((c, k) => {
      if (c.quantity <= i && cost[i - c.quantity] + c.price < cost[i]) {
        cost[i] = cost[i - c.quantity] + c.price;
        step[i] = k + 1;
      }
    });
  }

  const counts = new Map<number, number>();
  for (let i = n; i > 0; ) {
    const k = step[i];
    counts.set(k, (counts.get(k) ?? 0) + 1);
    i -= k === 0 ? 1 : combos[k - 1].quantity;
  }
  const parts: PricePart[] = [...counts]
    .map(([k, count]) =>
      k === 0
        ? ({ quantity: 1, price: unitPrice, count, kind: "single" } as const)
        : ({ quantity: combos[k - 1].quantity, price: combos[k - 1].price, count, kind: "combo" } as const),
    )
    .sort((a, b) => b.quantity - a.quantity);
  return { total: cost[n], parts };
}

/** Weighed totals are rounded to the nearest 500 ₫ (cash-friendly), and never below 500 ₫. */
export const WEIGHT_ROUNDING = 500;

/**
 * Price of `grams` of a product sold at `pricePerKg`. 37.500/kg × 130 g = 4.875 -> 5.000.
 *
 * From 1 kg up, the 1 kg price applies (pro rata). Below 1 kg, the admin's `points` apply instead:
 * the weight is charged at the rate of the heaviest point not above it (below the lightest point,
 * at the lightest point's rate). E.g. 100 g = 15.000 -> 130 g = 19.500. No points = plain price per kg.
 */
export function weightPrice(pricePerKg: number, grams: number, points: WeightPrice[] = []): number {
  if (!(grams > 0)) return 0;
  let perGram = pricePerKg / 1000;
  if (grams < 1000) {
    const tiers = points.filter((p) => p.grams > 0 && p.grams < 1000).sort((a, b) => a.grams - b.grams);
    const tier = tiers.filter((p) => p.grams <= grams).pop() ?? tiers[0];
    if (tier) perGram = tier.price / tier.grams;
  }
  const exact = perGram * grams;
  return Math.max(WEIGHT_ROUNDING, Math.round(exact / WEIGHT_ROUNDING) * WEIGHT_ROUNDING);
}
