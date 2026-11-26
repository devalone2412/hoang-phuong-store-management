import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "./schema";

describe("createUserSchema", () => {
  it("lowercases and trims the username", () => {
    const r = createUserSchema.parse({ username: "  Lan.Nguyen " });
    expect(r.username).toBe("lan.nguyen");
  });
  it.each(["ab", "has space", "dấu", "x".repeat(33)])("rejects username %j", (username) => {
    expect(createUserSchema.safeParse({ username }).success).toBe(false);
  });
  it("turns a blank display name into null", () => {
    expect(createUserSchema.parse({ username: "lan", displayName: "  " }).displayName).toBeNull();
  });
});

describe("create then re-parse (form output is sent to the server)", () => {
  it("accepts the null a blank display name was turned into", () => {
    const once = createUserSchema.parse({ username: "lan", displayName: "" });
    expect(createUserSchema.parse(once)).toEqual({ username: "lan", displayName: null });
  });
});

describe("updateUserSchema", () => {
  it("allows partial updates", () => {
    expect(updateUserSchema.parse({ disabled: true })).toEqual({ disabled: true });
  });
});
