// Rasterises app/icon.svg (and scripts/icons-maskable.svg) into the PNG sizes phones want.
// Uses the Playwright Chromium that e2e already installs:  node scripts/gen-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const jobs = [
  { src: "app/icon.svg", out: "app/apple-icon.png", size: 180 },
  { src: "app/icon.svg", out: "public/icons/icon-192.png", size: 192 },
  { src: "app/icon.svg", out: "public/icons/icon-512.png", size: 512 },
  { src: "scripts/icons-maskable.svg", out: "public/icons/icon-maskable-512.png", size: 512 },
];

const browser = await chromium.launch();
try {
  for (const { src, out, size } of jobs) {
    const svg = await readFile(src, "utf8");
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await writeFile(out, await page.screenshot({ omitBackground: true }));
    await page.close();
    console.log("wrote", out);
  }
} finally {
  await browser.close();
}
