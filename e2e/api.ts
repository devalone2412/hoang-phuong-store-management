import { request, type APIRequestContext } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
/** Everything the tests create is named with this prefix so cleanup never touches real data. */
export const E2E_PREFIX = "E2E";
export const PAG_COUNT = 120;
export const LONG_NAME = `${E2E_PREFIX} ${"Z".repeat(70)}`;
export const LONG_CATEGORY = "E2E nhóm hàng có tên rất rất dài để thử";
export const E2E_CATEGORIES = ["E2E Chẵn", "E2E Lẻ", LONG_CATEGORY];
export const BEANS = { name: `${E2E_PREFIX} Đậu đen`, sku: "E2EBEAN", pricePerKg: 40_000 };

export function credentials() {
  const username = process.env.E2E_USERNAME ?? "admin";
  const password = process.env.E2E_PASSWORD;
  if (!password) {
    throw new Error(
      "Set E2E_PASSWORD (and E2E_USERNAME if it isn't 'admin') to the login of the server under test.\n" +
        "  e.g. E2E_PASSWORD='...' npm run e2e",
    );
  }
  return { username, password };
}

export async function loggedInApi(): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: BASE_URL });
  const res = await api.post("/api/auth/login", { data: credentials() });
  if (!res.ok()) throw new Error(`E2E login failed (${res.status()}). Check E2E_USERNAME / E2E_PASSWORD.`);
  return api;
}

/** Delete every category created by the tests (products using it just lose their group). */
export async function cleanupE2eCategories(api: APIRequestContext) {
  const res = await api.get("/api/categories");
  const { items } = (await res.json()) as { items: { id: string; name: string }[] };
  for (const c of items.filter((c) => c.name.startsWith(E2E_PREFIX))) await api.delete(`/api/categories/${c.id}`);
}

/** Soft-delete every product whose name or SKU contains the E2E prefix, then the E2E categories. */
export async function cleanupE2eProducts(api: APIRequestContext) {
  for (let guard = 0; guard < 20; guard++) {
    const res = await api.get(`/api/products?q=${E2E_PREFIX}&pageSize=100`);
    const { items } = (await res.json()) as { items: { id: string }[] };
    if (items.length === 0) break;
    await api.post("/api/products/bulk-delete", { data: { ids: items.map((i) => i.id) } });
  }
  await cleanupE2eCategories(api);
}

export async function seedE2eProducts(api: APIRequestContext) {
  // Products may only use categories the admin created, so these come first (an existing one is fine).
  for (const name of E2E_CATEGORIES) {
    const res = await api.post("/api/categories", { data: { name } });
    if (!res.ok() && res.status() !== 409) throw new Error(`Seeding category failed: ${res.status()} ${await res.text()}`);
  }
  const rows: Record<string, unknown>[] = Array.from({ length: PAG_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      name: `${E2E_PREFIX} Pag ${n}`,
      unit: "cái",
      category: i % 2 ? "E2E Chẵn" : "E2E Lẻ",
      sku: `E2EPAG${n}`,
      retailPrice: 1000 * (i + 1),
    };
  });
  rows.push({
    name: LONG_NAME,
    unit: "thùng",
    category: LONG_CATEGORY,
    sku: "E2ELONG",
    retailPrice: 999_999_999,
    costPrice: 777_777_777,
    combos: [
      { quantity: 3, price: 12_000 },
      { quantity: 9999, price: 999_999_999 },
    ],
  });
  rows.push({
    name: BEANS.name,
    unit: "kg",
    soldByWeight: true,
    category: "E2E Lẻ",
    sku: BEANS.sku,
    retailPrice: BEANS.pricePerKg,
  });
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.all(rows.slice(i, i + 10).map((r) => api.post("/api/products", { data: r })));
    for (const r of results) if (!r.ok()) throw new Error(`Seeding failed: ${r.status()} ${await r.text()}`);
  }
}
