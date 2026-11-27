import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** Below Tailwind's `md` breakpoint the products page renders cards instead of a table. */
export const isPhoneWidth = (page: Page) => (page.viewportSize()?.width ?? 1024) < 768;
export const isTouch = (testInfo: TestInfo) => !!testInfo.project.use.hasTouch;

export const productRows = (page: Page) => page.locator(isPhoneWidth(page) ? "main ul > li" : "tbody tr");

export const searchBox = (page: Page) => page.getByLabel("Tìm sản phẩm");
export const pagerSummary = (page: Page) => page.getByText(/\d+–\d+ \/ \d+ sản phẩm/);

/** Rendered by the server, so clicks can land before React attaches handlers; retry until they take effect. */
export async function openProductForm(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Thêm sản phẩm" }).click();
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

/** React marks DOM nodes it has hydrated with a `__reactProps$…` key; wait for the search box to have one. */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('input[aria-label="Tìm sản phẩm"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
}

/**
 * Type into the search box and wait for the list to react (retrying if typed before hydration).
 * Only visible matches count: from `md` up the page holds both the (hidden) phone cards and the table.
 */
export async function searchFor(page: Page, text: string, expectVisible: string | RegExp) {
  await waitForHydration(page);
  await expect(async () => {
    await searchBox(page).fill(text);
    await expect(page.getByText(expectVisible).filter({ visible: true }).first()).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 15_000 });
}

export type LayoutAudit = { hOverflow: number; offenders: string[]; smallTargets: string[] };

/** Measures the current page: sideways scroll, elements poking outside the viewport, tiny tap targets. */
export function auditLayout(page: Page): Promise<LayoutAudit> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}:${(el.textContent || "").trim().slice(0, 20)}`;
    // Content inside its own horizontal scroller (e.g. a wide table) is allowed to be wider than the page.
    const scrollsInside = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === "auto" || o === "scroll" || o === "hidden") && p.getBoundingClientRect().right <= vw + 1) return true;
      }
      return false;
    };

    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => visible(el) && !el.closest("[data-sonner-toaster]") && !el.classList.contains("sr-only"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (r.right > vw + 1 || r.left < -1) && !scrollsInside(el);
      })
      .slice(0, 5)
      .map(label);

    const smallTargets = [...document.querySelectorAll("button, a[href], input:not([type=file]), select, [role=checkbox]")]
      .filter((el) => visible(el) && !el.closest("[data-sonner-toaster]"))
      .filter((el) => {
        // A checkbox inside a <label> is tapped through the label, so measure that.
        const target = el.closest("label") ?? el;
        const r = target.getBoundingClientRect();
        return r.height < 32 || r.width < 32;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      });

    return { hOverflow: document.documentElement.scrollWidth - vw, offenders, smallTargets: [...new Set(smallTargets)].slice(0, 6) };
  });
}

/** Asserts the page has no sideways scroll or off-screen elements (and, on touch devices, no tiny tap targets). */
export async function expectLayoutOk(page: Page, testInfo: TestInfo, where: string) {
  const a = await auditLayout(page);
  expect(a.hOverflow, `${where}: page scrolls sideways by ${a.hOverflow}px`).toBeLessThanOrEqual(1);
  expect(a.offenders, `${where}: elements outside the viewport`).toEqual([]);
  if (isTouch(testInfo)) expect(a.smallTargets, `${where}: tap targets under 32px`).toEqual([]);
}

/**
 * A modal must sit fully inside the screen on both axes (landscape phones and the on-screen keyboard
 * are where tall dialogs get clipped), and its main button must be reachable. Polls because dialogs
 * zoom in when they open.
 */
export async function expectDialogFits(page: Page, dialog: Locator, where: string, primary?: Locator) {
  const vp = page.viewportSize()!;
  await expect(dialog).toBeVisible();
  await expect
    .poll(
      async () => {
        const b = await dialog.boundingBox();
        if (!b) return "no box";
        const out: string[] = [];
        if (b.x < -1) out.push(`left ${Math.round(b.x)}`);
        if (b.y < -1) out.push(`top ${Math.round(b.y)}`);
        if (b.x + b.width > vp.width + 1) out.push(`right +${Math.round(b.x + b.width - vp.width)}`);
        if (b.y + b.height > vp.height + 1) out.push(`bottom +${Math.round(b.y + b.height - vp.height)}`);
        return out.join(", ") || "fits";
      },
      { message: `${where}: dialog sticks out of the ${vp.width}x${vp.height} screen` },
    )
    .toBe("fits");
  if (primary) {
    await primary.scrollIntoViewIfNeeded();
    const b = (await primary.boundingBox())!;
    expect(b.y, `${where}: main button above the screen`).toBeGreaterThanOrEqual(-1);
    expect(b.y + b.height, `${where}: main button below the screen`).toBeLessThanOrEqual(vp.height + 1);
  }
}
