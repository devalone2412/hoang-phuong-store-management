/**
 * Normalise Vietnamese text for accent-insensitive search:
 * "Nước mắm Nam Ngư" -> "nuoc mam nam ngu", "Đường" -> "duong".
 */
export function normalizeVi(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a search query into normalised words. */
export function searchTerms(query: string): string[] {
  const n = normalizeVi(query);
  return n ? n.split(" ") : [];
}
