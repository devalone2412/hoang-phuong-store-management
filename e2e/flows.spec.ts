import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./api";
import { openProductForm, pagerSummary, productRows, searchFor } from "./helpers";

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
  await dialog.locator("#wholesalePrice").fill("4,5k");
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

  // Lookup page: image, retail, wholesale and combo, but never the cost price.
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
