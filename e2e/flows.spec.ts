import { expect, test } from "@playwright/test";
import { BEANS, E2E_PREFIX } from "./api";
import { openProductForm, pagerSummary, productRows, searchBox, searchFor, waitForHydration } from "./helpers";

// These tests change data (delete + undo, create), so run them on one phone and one desktop only.
test.beforeEach(({}, testInfo) => {
  test.skip(!["iphone-se", "laptop"].includes(testInfo.project.name), "data-changing flow: one phone + one desktop is enough");
});

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("deleting every row on the last page steps back a page, and Undo restores them", async ({ page }) => {
  page.on("dialog", (d) => d.accept()); // window.confirm
  await page.goto("/products");
  await searchFor(page, `${E2E_PREFIX} Pag`, "1–20 / 120 sản phẩm");

  const next = page.getByRole("button", { name: "Trang sau" });
  for (const range of ["21–40", "41–60", "61–80", "81–100", "101–120"]) {
    await next.click();
    await expect(page.getByText(`${range} / 120 sản phẩm`)).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Chọn tất cả" }).click();
  await expect(page.getByText("Đã chọn 20")).toBeVisible();
  await page.getByText("Đã chọn 20").locator("..").getByRole("button", { name: "Xóa" }).click();

  // Page 6 no longer exists, so we land on the new last page instead of an empty one.
  await expect(page.getByText("Hoàn tác")).toBeVisible();
  await expect(page.getByText("81–100 / 100 sản phẩm")).toBeVisible();
  await expect(productRows(page)).toHaveCount(20);

  await page.getByText("Hoàn tác").click();
  await expect(pagerSummary(page)).toContainText("/ 120 sản phẩm");
  await expect(page.getByText("Đã khôi phục")).toBeVisible();
});

test("creates a product with a photo and combos; both pages show the image and every price", async ({ page }) => {
  const name = `${E2E_PREFIX} Flow ${Date.now()}`;
  await page.goto("/products");
  const dialog = await openProductForm(page);

  await page.locator('input[aria-label="Chọn ảnh từ thiết bị"]').setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  const preview = dialog.getByRole("img", { name: "Ảnh sản phẩm" });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await dialog.locator("#name").fill(name);
  await dialog.locator("#unit").fill("gói");
  await dialog.locator("#retailPrice").fill("5k");
  await dialog.locator("#costPrice").fill("3k");
  await dialog.getByRole("button", { name: "Thêm combo" }).click();
  await dialog.getByLabel("Số lượng combo 1").fill("3");
  await dialog.getByLabel("Giá combo 1").fill("12k");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm sản phẩm")).toBeVisible();

  // Products page: thumbnail + every price, including cost and the combo.
  await searchFor(page, `${E2E_PREFIX} Flow`, name);
  const row = productRows(page).filter({ hasText: name });
  await expect(row).toContainText("Giá lẻ");
  await expect(row).toContainText("5.000");
  await expect(row).toContainText("4.500");
  await expect(row).toContainText("3.000");
  await expect(row).toContainText("Combo 3 gói");
  await expect(row).toContainText("12.000");
  const thumb = row.getByRole("img", { name });
  await expect.poll(() => thumb.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  // Lookup page: image, retail and combo, but never the cost price.
  await page.goto("/");
  await searchFor(page, `${E2E_PREFIX} Flow`, name);
  const card = page.locator("main li").filter({ hasText: name });
  await expect(card).toContainText("Combo 3 gói");
  await expect(card).toContainText("4.500");
  await expect(card).not.toContainText("Giá vốn");
  await expect(card).not.toContainText("3.000 ₫");
  await expect.poll(() => card.getByRole("img", { name }).evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
});

test("price boxes: k / tr buttons build shorthand and show what it means", async ({ page }) => {
  await page.goto("/products");
  const dialog = await openProductForm(page);
  const retail = dialog.locator("#retailPrice");
  const field = dialog.locator("[data-money-field]").filter({ has: retail });

  await retail.fill("15");
  await field.getByRole("button", { name: "Nhân nghìn" }).click();
  await expect(retail).toHaveValue("15k");
  await expect(field).toContainText("= 15.000");

  await field.getByRole("button", { name: "Nhân triệu" }).click(); // replaces k, doesn't stack
  await expect(retail).toHaveValue("15tr");
  await expect(field).toContainText("= 15.000.000");

  await retail.fill("1,2");
  await field.getByRole("button", { name: "Nhân triệu" }).click();
  await expect(field).toContainText("= 1.200.000");

  await retail.fill("15");
  await field.getByRole("button", { name: "Thêm 000" }).click();
  await expect(retail).toHaveValue("15000");

  await retail.fill("20k");
  await dialog.locator("#name").focus(); // leaving the box tidies the text
  await expect(retail).toHaveValue("20.000");
});

test("admin avatar: initials first, then upload a photo, survive a reload, then remove it", async ({ page, request }) => {
  await page.goto("/");
  const avatar = page.getByTestId("admin-avatar");
  // Start from a known state in case an earlier run left a photo behind.
  await request.put("/api/profile", { data: { avatarKey: null } });
  await page.reload();
  await expect(page.getByTestId("admin-avatar-initials")).toBeVisible();
  const box = await avatar.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.y).toBeLessThan(40);
  expect(box!.x + box!.width).toBeGreaterThan(vw - 150); // far right of the header

  await page.locator('input[aria-label="Chọn ảnh đại diện từ thiết bị"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Đã cập nhật ảnh đại diện")).toBeVisible();
  const img = avatar.getByRole("img", { name: "Ảnh đại diện" });
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  expect(await img.getAttribute("src")).toMatch(/^\/api\/images\//);

  await page.reload();
  await expect(avatar.getByRole("img", { name: "Ảnh đại diện" })).toBeVisible();

  await avatar.click();
  await page.getByRole("menuitem", { name: "Xóa ảnh đại diện" }).click();
  await expect(page.getByTestId("admin-avatar-initials")).toBeVisible();
});

test("profile API needs a session", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await anon.get("/api/profile")).status()).toBe(401);
  expect((await anon.put("/api/profile", { data: { avatarKey: null } })).status()).toBe(401);
  await anon.dispose();
});

test("admin manages Nhóm hàng: add, pick in the product form, rename (products follow), delete", async ({ page }) => {
  const stamp = Date.now();
  const first = `${E2E_PREFIX} Nhóm ${stamp}`;
  const renamed = `${first} đổi`;
  const name = `${E2E_PREFIX} Cat ${stamp}`;

  await page.goto("/products");
  await waitForHydration(page);
  const manage = page.getByRole("button", { name: "Quản lý nhóm hàng" });
  await expect(async () => {
    await manage.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên nhóm hàng mới").fill(first);
  await dialog.getByRole("button", { name: "Thêm" }).click();
  await expect(dialog.getByText(first)).toBeVisible();
  // A duplicate (any capitalisation) is refused.
  await dialog.getByLabel("Tên nhóm hàng mới").fill(first.toUpperCase());
  await dialog.getByRole("button", { name: "Thêm" }).click();
  await expect(dialog.getByText("Nhóm hàng đã tồn tại")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng" }).click();

  // The product form offers the list as a dropdown, and only the list.
  dialog = await openProductForm(page);
  await dialog.locator("#name").fill(name);
  await dialog.locator("#unit").fill("cái");
  await dialog.locator("#retailPrice").fill("5k");
  await expect(dialog.locator("#category option", { hasText: first })).toHaveCount(1);
  await dialog.locator("#category").selectOption(first);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm sản phẩm")).toBeVisible();

  const categoryOf = async () => {
    const res = await page.request.get(`/api/products?q=${encodeURIComponent(name)}`);
    return ((await res.json()) as { items: { category: string | null }[] }).items[0]?.category;
  };
  expect(await categoryOf()).toBe(first);

  // Renaming the group renames it on its products.
  await page.getByRole("button", { name: "Quản lý nhóm hàng" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: `Đổi tên nhóm ${first}` }).click();
  await dialog.getByLabel(`Tên mới của nhóm ${first}`).fill(renamed);
  await dialog.getByLabel(`Tên mới của nhóm ${first}`).press("Enter");
  await expect(dialog.getByText(renamed)).toBeVisible();
  expect(await categoryOf()).toBe(renamed);

  // Deleting it leaves the product without a group.
  page.once("dialog", (d) => void d.accept());
  await dialog.getByRole("button", { name: `Xóa nhóm ${renamed}` }).click();
  await expect(dialog.getByText(renamed)).toHaveCount(0);
  expect(await categoryOf()).toBeNull();
});

test("weighed product: price per kg in the form, then 1,2kg and a 100g chip in Tính tiền", async ({ page }) => {
  const name = `${E2E_PREFIX} Cân ${Date.now()}`;
  await page.goto("/products");
  const dialog = await openProductForm(page);
  await dialog.locator("#name").fill(name);
  await dialog.getByLabel("Bán theo cân (kg / gram)").click();
  await expect(dialog.locator("#unit")).toHaveValue("kg");
  await expect(dialog.locator("#unit")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Thêm combo" })).toHaveCount(0);
  await dialog.locator("#retailPrice").fill("40k");
  await expect(dialog.getByText("100 g 4.000 ₫ · 200 g 8.000 ₫ · 500 g 20.000 ₫")).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm sản phẩm")).toBeVisible();

  await page.goto("/checkout");
  const box = page.getByLabel("Mã vạch, SKU hoặc tên sản phẩm");
  await expect(async () => {
    await box.fill(name);
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: new RegExp(name) }).click();

  // No weight yet: the line says so and adds nothing to the total.
  await expect(page.getByText("Chưa nhập cân")).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("0 ₫");

  const weight = page.getByLabel(`Số cân ${name}`);
  await weight.fill("1,2");
  await expect(page.getByTestId("checkout-total")).toHaveText("48.000 ₫");
  await page.getByRole("button", { name: `100 g – Số cân ${name}` }).click();
  await expect(page.getByTestId("checkout-total")).toHaveText("4.000 ₫");
  await weight.fill("130g");
  await expect(page.getByTestId("checkout-total")).toHaveText("5.000 ₫"); // 5.200 rounds to the nearest 500
  await page.getByRole("button", { name: `Tăng 100 g – Số cân ${name}` }).click();
  await expect(weight).toHaveValue("230g");
});

test("weighed product: under 1 kg the price rows apply, from 1 kg the kg price", async ({ page }) => {
  const name = `${E2E_PREFIX} Cân bậc ${Date.now()}`;
  await page.goto("/products");
  const dialog = await openProductForm(page);
  await dialog.locator("#name").fill(name);
  await dialog.getByLabel("Bán theo cân (kg / gram)").click();
  await dialog.locator("#retailPrice").fill("120k");
  await dialog.getByRole("button", { name: "Thêm mức" }).click();
  await dialog.getByLabel("Mức cân 1").fill("100g");
  await dialog.getByLabel("Giá mức cân 1").fill("15k");
  await dialog.getByRole("button", { name: "Thêm mức" }).click();
  await dialog.getByLabel("Mức cân 2").fill("200g");
  await dialog.getByLabel("Giá mức cân 2").fill("28k");
  await expect(dialog.getByText("100 g 15.000 ₫ · 200 g 28.000 ₫ · 500 g 70.000 ₫")).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm sản phẩm")).toBeVisible();

  await page.goto("/checkout");
  const box = page.getByLabel("Mã vạch, SKU hoặc tên sản phẩm");
  await expect(async () => {
    await box.fill(name);
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: new RegExp(name) }).click();

  const weight = page.getByLabel(`Số cân ${name}`);
  await weight.fill("100g");
  await expect(page.getByTestId("checkout-total")).toHaveText("15.000 ₫");
  await weight.fill("1kg");
  await expect(page.getByTestId("checkout-total")).toHaveText("120.000 ₫");
  // Under 1 kg the 200 g rate applies (140/g), not the 1 kg rate.
  await weight.fill("300g");
  await expect(page.getByTestId("checkout-total")).toHaveText("42.000 ₫");
  await weight.fill("999g");
  await expect(page.getByTestId("checkout-total")).toHaveText("140.000 ₫");
});

test("Tra giá: weighed product has a calculator, and the group filter lists a whole group", async ({ page }) => {
  await page.goto("/");
  await searchFor(page, BEANS.name, BEANS.name);
  const card = page.locator("main li").filter({ hasText: BEANS.name });
  await expect(card).toContainText("Bán theo cân");
  await expect(card).toContainText("Giá / kg");
  await card.getByLabel(`Số cân ${BEANS.name}`).fill("300");
  await expect(card.getByTestId("weight-total")).toHaveText("12.000 ₫");
  await card.getByRole("button", { name: `1 kg – Số cân ${BEANS.name}` }).click();
  await expect(card.getByTestId("weight-total")).toHaveText("40.000 ₫");

  await searchBox(page).fill("");
  await page.getByLabel("Lọc theo nhóm hàng").selectOption("E2E Chẵn");
  await expect(page.locator("main li").first()).toContainText("E2E Chẵn");
  await expect(page.getByText(/^1–20 \/ 60 sản phẩm$/)).toBeVisible();
});

test("Tính tiền: add an amount for something that isn't a stored product", async ({ page }) => {
  await page.goto("/checkout");
  const open = page.getByRole("button", { name: "Thêm khoản khác" });
  const form = page.getByRole("form", { name: "Thêm khoản khác" });
  // Rendered by the server, so the click can land before React attaches handlers.
  await expect(async () => {
    await open.click();
    await expect(form).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });

  // An empty or invalid amount is refused.
  await form.getByRole("button", { name: "Thêm vào đơn" }).click();
  await expect(form.getByText("Nhập số tiền hợp lệ")).toBeVisible();

  await form.locator("#extra-amount").fill("15k");
  await form.getByLabel("Tên (không bắt buộc)").fill("Túi bóc");
  await form.getByRole("button", { name: "Thêm vào đơn" }).click();

  const item = page.getByRole("list", { name: "Khoản khác" }).getByRole("listitem");
  await expect(item).toContainText("Túi bóc");
  await expect(page.getByTestId("checkout-total")).toHaveText("15.000 ₫");

  await page.getByRole("button", { name: "Tăng Túi bóc" }).click();
  await expect(page.getByTestId("checkout-total")).toHaveText("30.000 ₫");

  // A second one with no name, then it survives a reload together with the first.
  await open.click();
  await page.locator("#extra-amount").fill("2,5k");
  await page.getByRole("button", { name: "Thêm vào đơn" }).click();
  await expect(page.getByText("Khoản khác", { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("32.500 ₫");
  await page.reload();
  await expect(page.getByTestId("checkout-total")).toHaveText("32.500 ₫");

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Đơn mới" }).click();
  await expect(page.getByTestId("checkout-total")).toHaveText("0 ₫");
});
