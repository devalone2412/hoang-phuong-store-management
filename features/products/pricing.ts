import type { Combo } from "./schema";

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

/** What the price depends on: 1 kg (`retailPrice`) and, optionally, 100 g (`price100g`). */
export type WeighedPrices = { retailPrice: number; price100g?: number | null };

/** Price of 100 g, charged under 1 kg: the admin's, or the kg price ÷ 10 when none is set. */
export function under1kgPrice(p: WeighedPrices): number {
  return p.price100g ?? Math.round(p.retailPrice / 10);
}

/**
 * The rate `grams` is charged at and the exact (unrounded) amount. From 1 kg up the kg price applies;
 * under 1 kg the 100 g price does. Without a 100 g price everything is plain per kg.
 */
export function weightRate(p: WeighedPrices, grams: number): { per: "kg" | "100g"; price: number; exact: number } {
  if (grams < 1000 && p.price100g != null) return { per: "100g", price: p.price100g, exact: (p.price100g * grams) / 100 };
  return { per: "kg", price: p.retailPrice, exact: (p.retailPrice * grams) / 1000 };
}

/** Price of `grams`, rounded to the nearest 500 ₫ (never below 500). 37.500/kg × 130 g = 4.875 -> 5.000. */
export function weightPrice(p: WeighedPrices, grams: number): number {
  if (!(grams > 0)) return 0;
  return Math.max(WEIGHT_ROUNDING, Math.round(weightRate(p, grams).exact / WEIGHT_ROUNDING) * WEIGHT_ROUNDING);
}
