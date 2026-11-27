import { expect, test } from "@playwright/test";
import { loggedInApi } from "./api";
import { expectDialogFits, expectLayoutOk, waitForHydration } from "./helpers";

// Runs on every device project (phones in both orientations, tablets, laptop, desktop): a modal that
// is taller than a landscape phone used to be clipped with its buttons off-screen.

/** Server-rendered buttons can be clicked before React attaches handlers; retry until the dialog opens. */
async function open(page: import("@playwright/test").Page, click: () => Promise<void>, role: "dialog" | "alertdialog" = "dialog") {
  const dialog = page.getByRole(role);
  await expect(async () => {
    await click();
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

test.describe("scanner dialog", () => {
  for (const [path, label] of [
    ["/", "Tra giá"],
    ["/products", "Sản phẩm"],
    ["/checkout", "Tính tiền"],
  ] as const) {
    test(`fits the screen on ${label}`, async ({ page }, testInfo) => {
      await page.goto(path);
      if (path !== "/checkout") await waitForHydration(page); // /checkout has no search box to probe
      const scan = page.getByRole("button", { name: "Quét mã vạch bằng camera" }).first();
      const dialog = await open(page, () => scan.click());
      await expect(page.locator("video")).toBeVisible();
      await expectDialogFits(page, dialog, `scanner on ${label}`, dialog.getByRole("button", { name: "Đóng" }));
      await expectLayoutOk(page, testInfo, `scanner on ${label}`);
    });
  }
});

test("Nhóm hàng dialog fits the screen, even with a long name in the list", async ({ page }, testInfo) => {
  await page.goto("/products");
  await waitForHydration(page);
  const dialog = await open(page, () => page.getByRole("button", { name: "Quản lý nhóm hàng" }).click());
  await expectDialogFits(page, dialog, "Nhóm hàng dialog", dialog.getByRole("button", { name: "Đóng" }).last());
  await expectLayoutOk(page, testInfo, "Nhóm hàng dialog");
});

test.describe("staff dialogs", () => {
  // 32 characters without a space: the longest username allowed, and the worst case for wrapping.
  const username = `e2e-${"x".repeat(28)}`;
  let userId = "";

  test.beforeAll(async () => {
    const admin = await loggedInApi();
    const res = await admin.post("/api/users", { data: { username, displayName: null } });
    expect(res.status()).toBe(201);
    userId = ((await res.json()) as { user: { id: string } }).user.id;
    await admin.dispose();
  });
  test.afterAll(async () => {
    const admin = await loggedInApi();
    await admin.delete(`/api/users/${userId}`);
    await admin.dispose();
  });

  test("create form fits and Tạo tài khoản stays reachable", async ({ page }, testInfo) => {
    await page.goto("/staff");
    const dialog = await open(page, () => page.getByRole("button", { name: "Thêm thành viên" }).click());
    await expectDialogFits(page, dialog, "create member", dialog.getByRole("button", { name: "Tạo tài khoản" }));
    await expectLayoutOk(page, testInfo, "create member");
  });

  test("reset and delete confirmations fit and wrap a 32-character username", async ({ page }, testInfo) => {
    await page.goto("/staff");
    const row = page.getByTestId("staff-row").filter({ hasText: username });
    const menu = () => row.getByRole("button", { name: `Thao tác với ${username}` });

    let dialog = await open(
      page,
      async () => {
        await menu().click();
        await page.getByRole("menuitem", { name: "Đặt lại mật khẩu" }).click();
      },
      "alertdialog",
    );
    await expectDialogFits(page, dialog, "reset confirmation", dialog.getByRole("button", { name: "Đặt lại" }));
    await expectLayoutOk(page, testInfo, "reset confirmation");
    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();

    dialog = await open(
      page,
      async () => {
        await menu().click();
        await page.getByRole("menuitem", { name: "Xóa" }).click();
      },
      "alertdialog",
    );
    await expectDialogFits(page, dialog, "delete confirmation", dialog.getByRole("button", { name: "Xóa", exact: true }));
    await expectLayoutOk(page, testInfo, "delete confirmation");
    await dialog.getByRole("button", { name: "Hủy" }).click();
  });

  test("credentials dialog fits and its close button is reachable", async ({ page }, testInfo) => {
    // Resetting the throwaway user's password is what opens the one-time credentials dialog.
    await page.goto("/staff");
    const row = page.getByTestId("staff-row").filter({ hasText: username });
    const confirm = await open(
      page,
      async () => {
        await row.getByRole("button", { name: `Thao tác với ${username}` }).click();
        await page.getByRole("menuitem", { name: "Đặt lại mật khẩu" }).click();
      },
      "alertdialog",
    );
    await confirm.getByRole("button", { name: "Đặt lại" }).click();
    const dialog = page.getByRole("dialog");
    await expect(page.getByTestId("generated-password")).toBeVisible();
    await expectDialogFits(page, dialog, "credentials", dialog.getByRole("button", { name: "Đã lưu, đóng" }));
    await expectLayoutOk(page, testInfo, "credentials");
    await dialog.getByRole("button", { name: "Đã lưu, đóng" }).click();
  });
});
