import { expect, test } from "@playwright/test";
import { E2E_PREFIX, credentials } from "./api";
import { expectLayoutOk, openProductForm, pagerSummary, productRows, searchBox, searchFor } from "./helpers";

// These run on every device project in playwright.config.ts: phones, tablets (both orientations), laptop, desktop.

test.describe("login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("fits the screen, is hydration-safe and never puts the password in the URL", async ({ page }, testInfo) => {
    // The server HTML has no inputs: password-manager extensions inject into inputs before React
    // hydrates, which used to cause hydration-mismatch errors.
    const html = await (await page.request.get("/login")).text();
    expect(html).not.toContain("<input");

    await page.goto("/login");
    await expect(page.locator("#username")).toBeVisible();
    await expectLayoutOk(page, testInfo, "login");

    await page.locator("#username").fill("someone");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByRole("alert")).toContainText("Sai tên đăng nhập hoặc mật khẩu");
    expect(page.url()).not.toContain("password");

    const { username, password } = credentials();
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  });

  test("pages and API require a session", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts/);
    expect((await page.request.get("/api/products")).status()).toBe(401);
    expect((await page.request.get("/api/lookup?q=x")).status()).toBe(401);
  });
});

test.describe("lookup page", () => {
  test("shows results, paginates, resets on a new query, and fits the screen", async ({ page }, testInfo) => {
    await page.goto("/");
    await expectLayoutOk(page, testInfo, "lookup (empty)");

    await searchFor(page, `${E2E_PREFIX} Pag`, "E2E Pag 001");
    await expect(page.getByText("1–20 / 120 sản phẩm")).toBeVisible();
    await expectLayoutOk(page, testInfo, "lookup results");

    const next = page.getByRole("button", { name: "Trang sau" });
    await next.scrollIntoViewIfNeeded();
    await expectLayoutOk(page, testInfo, "lookup pagination");

    await next.click();
    await expect(page.getByText("E2E Pag 021")).toBeVisible();
    await expect(page.getByText("E2E Pag 001")).toHaveCount(0);
    await expect(page.getByText("21–40 / 120 sản phẩm")).toBeVisible();

    await page.getByRole("button", { name: "Trang trước" }).click();
    await expect(page.getByText("E2E Pag 001")).toBeVisible();

    // A new query always starts on page 1.
    await next.click();
    await expect(page.getByText("21–40 / 120 sản phẩm")).toBeVisible();
    await searchBox(page).fill(`${E2E_PREFIX} Pag 1`);
    await expect(page.getByText(/^1–\d+ \/ \d+ sản phẩm$/)).toBeVisible();
  });

  test("pins an exact SKU match and handles no results", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "E2EPAG007", "E2E Pag 007");
    await expect(page.getByRole("button", { name: "Trang sau" })).toHaveCount(0);

    await searchFor(page, "khong-co-san-pham-nay-xyz", "Không tìm thấy sản phẩm nào.");
  });

  test("opens the barcode scanner with a live camera stream", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(async () => {
      await page.getByRole("button", { name: "Quét mã vạch bằng camera" }).click();
      await expect(page.locator("video")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    // HAVE_CURRENT_DATA or better means the fake camera is actually delivering frames.
    await expect
      .poll(() => page.evaluate(() => { const v = document.querySelector("video"); return !!v?.srcObject && v.readyState >= 2; }), { timeout: 15_000 })
      .toBe(true);
    await expectLayoutOk(page, testInfo, "scanner");
    await page.keyboard.press("Escape");
    await expect(page.locator("video")).toHaveCount(0);
  });
});

test.describe("products page", () => {
  test("lists, paginates, changes page size, clears selection, and fits the screen", async ({ page }, testInfo) => {
    await page.goto("/products");
    await searchFor(page, `${E2E_PREFIX} Pag`, "1–20 / 120 sản phẩm");
    await expect(productRows(page)).toHaveCount(20);
    await expectLayoutOk(page, testInfo, "products");

    const next = page.getByRole("button", { name: "Trang sau" });
    await next.scrollIntoViewIfNeeded();
    await expectLayoutOk(page, testInfo, "products pagination");

    const firstRow = await productRows(page).first().innerText();
    await next.click();
    await expect(page.getByText("21–40 / 120 sản phẩm")).toBeVisible();
    // The summary updates at once, but the rows keep showing the old page until the new data arrives.
    await expect.poll(() => productRows(page).first().innerText()).not.toBe(firstRow);

    await page.getByLabel("Số sản phẩm mỗi trang").selectOption({ label: "50 / trang" });
    await expect(page.getByText("1–50 / 120 sản phẩm")).toBeVisible();
    await expect(productRows(page)).toHaveCount(50);

    // Selection only ever refers to rows on screen.
    await productRows(page).first().getByRole("checkbox").click();
    await expect(page.getByText("Đã chọn 1")).toBeVisible();
    await expectLayoutOk(page, testInfo, "products with selection");
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByText("51–100 / 120 sản phẩm")).toBeVisible();
    await expect(page.getByText(/Đã chọn/)).toHaveCount(0);
  });

  test("category filter narrows the list and resets to page 1", async ({ page }) => {
    await page.goto("/products");
    await searchFor(page, `${E2E_PREFIX} Pag`, "1–20 / 120 sản phẩm");
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByText("21–40 / 120 sản phẩm")).toBeVisible();
    await page.getByLabel("Lọc theo nhóm hàng").selectOption("E2E Chẵn");
    await expect(page.getByText("1–20 / 60 sản phẩm")).toBeVisible();
  });

  test("product form fits the screen, keeps Lưu reachable, and opens the scanner", async ({ page }, testInfo) => {
    await page.goto("/products");
    const dialog = await openProductForm(page);
    for (let i = 0; i < 3; i++) await dialog.getByRole("button", { name: "Thêm combo" }).click();
    await expectLayoutOk(page, testInfo, "product form");

    const vp = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);

    // On short (landscape) screens the form scrolls inside the dialog; the buttons must stay reachable.
    const save = dialog.getByRole("button", { name: "Lưu" });
    await save.scrollIntoViewIfNeeded();
    const sb = (await save.boundingBox())!;
    expect(sb.y + sb.height).toBeLessThanOrEqual(vp.height + 1);

    await dialog.getByRole("button", { name: "Quét mã vạch bằng camera" }).scrollIntoViewIfNeeded();
    await dialog.getByRole("button", { name: "Quét mã vạch bằng camera" }).click();
    await expect(page.locator("video")).toBeVisible();
    await expectLayoutOk(page, testInfo, "scanner over product form");
  });

  test("very long product names don't break the layout", async ({ page }, testInfo) => {
    await page.goto("/");
    await searchFor(page, "ZZZZZ", /ZZZZZ/);
    await expectLayoutOk(page, testInfo, "lookup with a 70-character name");

    await page.goto("/products");
    await searchFor(page, "ZZZZZ", /ZZZZZ/);
    await expectLayoutOk(page, testInfo, "products with a 70-character name");
    await expect(pagerSummary(page)).toContainText("1–1 / 1");
  });
});
