import { request, type APIRequestContext } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
/** Everything the tests create is named with this prefix so cleanup never touches real data. */
export const E2E_PREFIX = "E2E";
export const PAG_COUNT = 120;
export const LONG_NAME = `${E2E_PREFIX} ${"Z".repeat(70)}`;

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

/** Soft-delete every product whose name or SKU contains the E2E prefix. */
export async function cleanupE2eProducts(api: APIRequestContext) {
  for (let guard = 0; guard < 20; guard++) {
    const res = await api.get(`/api/products?q=${E2E_PREFIX}&pageSize=100`);
    const { items } = (await res.json()) as { items: { id: string }[] };
    if (items.length === 0) return;
    await api.post("/api/products/bulk-delete", { data: { ids: items.map((i) => i.id) } });
  }
}

export async function seedE2eProducts(api: APIRequestContext) {
  const rows: Record<string, unknown>[] = Array.from({ length: PAG_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      name: `${E2E_PREFIX} Pag ${n}`,
      unit: "cái",
      category: i % 2 ? "E2E Chẵn" : "E2E Lẻ",
      sku: `E2EPAG${n}`,
      retailPrice: 1000 * (i + 1),
      wholesalePrice: 900 * (i + 1),
    };
  });
  rows.push({
    name: LONG_NAME,
    unit: "thùng",
    category: "E2E nhóm hàng có tên rất rất dài để thử",
    sku: "E2ELONG",
    retailPrice: 999_999_999,
    wholesalePrice: 888_888_888,
    costPrice: 777_777_777,
    combos: [
      { quantity: 3, price: 12_000 },
      { quantity: 9999, price: 999_999_999 },
    ],
  });
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.all(rows.slice(i, i + 10).map((r) => api.post("/api/products", { data: r })));
    for (const r of results) if (!r.ok()) throw new Error(`Seeding failed: ${r.status()} ${await r.text()}`);
  }
}
