/** Weights are whole grams everywhere (1,2 kg = 1200). */
export const MAX_GRAMS = 999_000;

/** A bare number below this is read as kilograms, otherwise as grams ("1,2" = 1,2 kg, "300" = 300 g). */
const BARE_KG_BELOW = 50;

const kg = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

/**
 * Parse what a person types into whole grams.
 *   "1,2kg" / "1.2kg" / "1,2" -> 1200   "100g" / "100 gram" / "100gr" -> 100   "300" -> 300
 *   "" -> null   garbage, zero or more than 999 kg -> NaN
 * A bare number is kilograms below 50 and grams from 50 up; type the unit to be explicit.
 */
export function parseWeight(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  const m = s.match(/^(\d+(?:[.,]\d+)?)(kg|kilogram|kilo|ki|g|gr|gam|gram)?$/);
  if (!m) return Number.NaN;
  const value = Number(m[1].replace(",", "."));
  const unit = m[2];

  const inKg = unit ? unit.startsWith("k") : value < BARE_KG_BELOW;
  const grams = Math.round(inKg ? value * 1000 : value);
  return Number.isFinite(grams) && grams > 0 && grams <= MAX_GRAMS ? grams : Number.NaN;
}

/** 300 -> "300 g", 1200 -> "1,2 kg", 1000 -> "1 kg" */
export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${kg.format(grams / 1000)} kg` : `${grams} g`;
}

/** What goes back into the box after a chip or ± tap: "300", "1,2 kg" style without the unit noise. */
export function weightInputText(grams: number | null): string {
  return grams == null ? "" : grams >= 1000 ? `${kg.format(grams / 1000)}kg` : `${grams}g`;
}
