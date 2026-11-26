import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Tên đăng nhập 3–32 ký tự: chữ thường, số, dấu . _ -");

// Blank means "no display name". `null` is accepted because the form sends its already-parsed
// value to the server, which parses it again with this same schema.
const displayNameSchema = z
  .string()
  .trim()
  .max(50, "Tên hiển thị tối đa 50 ký tự")
  .nullable()
  .transform((v) => v || null);

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
});

export const updateUserSchema = z.object({
  displayName: displayNameSchema.optional(),
  /** Ask the server to generate a new password (returned once in the response). */
  resetPassword: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

export type StaffUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarKey: string | null;
  disabled: boolean;
  createdAt: number;
};

/** Response of create / reset: the plain password exists only here and is never stored or readable again. */
export type StaffCredentials = { user: StaffUser; password: string };

export type Role = "admin" | "staff";
