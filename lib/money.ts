const vnd = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 15000 -> "15.000 ₫" */
export function formatVnd(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${vnd.format(value)} ₫`;
}

/** 15000 -> "15.000" (no currency sign, for inputs) */
export function formatVndNumber(value: number | null | undefined): string {
  if (value == null) return "";
  return vnd.format(value);
}

/**
 * Parse what a person types into whole VND.
 *   "15.000" -> 15000   "15,000" -> 15000   "15k" -> 15000
 *   "1.2tr" / "1,2tr" / "1.2m" -> 1200000   "" -> null   garbage -> NaN
 * A dot or comma followed by exactly three digits is a thousands separator;
 * otherwise it is a decimal mark (only valid with a k/tr/m suffix).
 */
export function parseVnd(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[₫đ\s]/g, "");
  if (!s) return null;

  const m = s.match(/^([\d.,]+)(k|nghin|nghìn|tr|trieu|triệu|m)?$/);
  if (!m) return Number.NaN;
  const [, num, suffix] = m;

  let multiplier = 1;
  if (suffix === "k" || suffix === "nghin" || suffix === "nghìn") multiplier = 1_000;
  else if (suffix) multiplier = 1_000_000;

  let value: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) {
    // thousands separators: 1.234.567
    value = Number(num.replace(/[.,]/g, ""));
  } else if (/^\d+([.,]\d+)?$/.test(num)) {
    value = Number(num.replace(",", "."));
    if (!suffix && !Number.isInteger(value)) return Number.NaN;
  } else {
    return Number.NaN;
  }

  const result = Math.round(value * multiplier);
  return Number.isFinite(result) ? result : Number.NaN;
}

/** Margin in VND and percent of retail, or null if cost is unknown. */
export function margin(retail: number, cost: number | null | undefined) {
  if (cost == null || retail <= 0) return null;
  const amount = retail - cost;
  return { amount, percent: (amount / retail) * 100 };
}

/** 1700000000000 -> "14/11/2023 05:13" (Vietnam time, whatever the device's zone is). */
export function formatDateTime(ms: number): string {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
