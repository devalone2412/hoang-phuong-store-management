import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/db/client";
import { users, type UserRow } from "@/db/schema";
import { thumbKey } from "@/features/products/schema";
import type { StaffUser } from "@/features/users/schema";
import { generatePassword, hashPassword } from "./password";
import { ConflictError } from "./products.repo";

const toStaff = (r: UserRow): StaffUser => ({
  id: r.id,
  username: r.username,
  displayName: r.displayName,
  avatarKey: r.avatarKey,
  disabled: r.disabledAt != null,
  createdAt: r.createdAt,
});

const taken = () => new ConflictError("username", "Tên đăng nhập đã được dùng");

export async function listUsers(db: Db) {
  return (await db.select().from(users).orderBy(asc(users.createdAt))).map(toStaff);
}

export async function createUser(db: Db, data: { username: string; displayName?: string | null }) {
  if (data.username === String(env.ADMIN_USERNAME ?? "").toLowerCase()) throw taken();
  const password = generatePassword();
  const now = Date.now();
  const row: UserRow = {
    id: ulid(),
    username: data.username,
    displayName: data.displayName ?? null,
    passwordHash: await hashPassword(password),
    avatarKey: null,
    sessionVersion: 1,
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(users).values(row);
  } catch (e) {
    if (/unique/i.test(String((e as Error)?.message) + String((e as Error)?.cause))) throw taken();
    throw e;
  }
  return { user: toStaff(row), password };
}

export async function updateUser(
  db: Db,
  id: string,
  data: { displayName?: string | null; resetPassword?: boolean; disabled?: boolean },
) {
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return null;
  const now = Date.now();
  const set: Partial<UserRow> = { updatedAt: now };
  if (data.displayName !== undefined) set.displayName = data.displayName;
  let password: string | undefined;
  if (data.resetPassword) {
    password = generatePassword();
    set.passwordHash = await hashPassword(password);
    set.sessionVersion = row.sessionVersion + 1;
  }
  if (data.disabled !== undefined) {
    set.disabledAt = data.disabled ? (row.disabledAt ?? now) : null;
    if (data.disabled && row.disabledAt == null) set.sessionVersion = (set.sessionVersion ?? row.sessionVersion) + 1;
  }
  await db.update(users).set(set).where(eq(users.id, id));
  return { user: toStaff({ ...row, ...set }), password };
}

export async function deleteUser(db: Db, id: string) {
  const row = await db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return false;
  await db.delete(users).where(eq(users.id, id));
  if (row.avatarKey) await env.IMAGES.delete([row.avatarKey, thumbKey(row.avatarKey)]).catch(() => {});
  return true;
}
