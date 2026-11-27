import { expect, request, test } from "@playwright/test";
import { BASE_URL, loggedInApi } from "./api";

const username = `e2e-staff-${Date.now().toString(36)}`;
let password = "";
let userId = "";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(async () => {
  const admin = await loggedInApi();
  const res = await admin.post("/api/users", { data: { username, displayName: "E2E Staff" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { user: { id: string }; password: string };
  userId = body.user.id;
  password = body.password;
  expect(password).toHaveLength(10);
  await admin.dispose();
});

test.afterAll(async () => {
  const admin = await loggedInApi();
  await admin.delete(`/api/users/${userId}`);
  await admin.dispose();
});

async function staffApi() {
  const api = await request.newContext({ baseURL: BASE_URL });
  const res = await api.post("/api/auth/login", { data: { username, password } });
  expect(res.ok()).toBe(true);
  return api;
}

test("staff see only Tra giá and Tính tiền and are kept out of admin pages", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[name=username]").fill(username);
  await page.locator("input[name=password]").fill(password);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByRole("link", { name: "Tra giá" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tính tiền" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sản phẩm" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Thành viên" })).toHaveCount(0);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/$/);
});

test("staff API: admin routes are forbidden and cost price is hidden", async () => {
  const api = await staffApi();
  expect((await api.get("/api/products")).status()).toBe(403);
  expect((await api.get("/api/users")).status()).toBe(403);
  // Staff may read the group list (Tra giá filters by it) but never change it.
  expect((await api.get("/api/categories")).ok()).toBe(true);
  expect((await api.post("/api/categories", { data: { name: "E2E staff" } })).status()).toBe(403);
  const lookup = await api.get("/api/lookup?q=e2e");
  expect(lookup.ok()).toBe(true);
  const body = (await lookup.json()) as { items: { costPrice: number | null }[] };
  for (const p of body.items) expect(p.costPrice).toBeNull();
  const profile = (await (await api.get("/api/profile")).json()) as { role: string; username: string };
  expect(profile).toMatchObject({ role: "staff", username });
  await api.dispose();
});

test("locking the account signs the staff member out", async () => {
  const api = await staffApi();
  expect((await api.get("/api/profile")).ok()).toBe(true);
  const admin = await loggedInApi();
  await admin.patch(`/api/users/${userId}`, { data: { disabled: true } });
  expect((await api.get("/api/profile")).status()).toBe(401);
  const relogin = await api.post("/api/auth/login", { data: { username, password } });
  expect(relogin.status()).toBe(403);
  await admin.patch(`/api/users/${userId}`, { data: { disabled: false } });
  await admin.dispose();
  await api.dispose();
});
