import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("collapses the middle for many pages, always keeping first, last and neighbours", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pageWindow(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
  });
  it("never repeats or skips a number", () => {
    for (let count = 1; count <= 40; count++)
      for (let page = 1; page <= count; page++) {
        const nums = pageWindow(page, count).filter((x): x is number => x !== "…");
        expect(nums).toEqual([...new Set(nums)].sort((a, b) => a - b));
        expect(nums).toContain(page);
        expect(nums[0]).toBe(1);
        expect(nums.at(-1)).toBe(count);
      }
  });
});
