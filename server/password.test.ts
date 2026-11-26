import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("round-trips and rejects a wrong password", async () => {
    const h = await hashPassword("s3cret!");
    expect(h).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword("s3cret!", h)).toBe(true);
    expect(await verifyPassword("other", h)).toBe(false);
  });

  it("verifies hashes in the format scripts/hash-password.mjs prints", async () => {
    const salt = Buffer.from("0123456789abcdef");
    const hash = pbkdf2Sync("pw1234", salt, 100_000, 32, "sha256");
    expect(await verifyPassword("pw1234", `pbkdf2$100000$${salt.toString("base64")}$${hash.toString("base64")}`)).toBe(true);
  });

  it("rejects a missing or garbled hash", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "nonsense")).toBe(false);
  });
});

describe("generatePassword", () => {
  it("makes a 10 character password from unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generatePassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
  });
  it("does not repeat", () => {
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
});
