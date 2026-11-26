import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "hp_session";
const SESSION_DAYS = 7;

const key = () => new TextEncoder().encode(env.SESSION_SECRET);

export type Session = { role: "admin" } | { role: "staff"; userId: string; username: string };

/** What a login attempt can end in besides a session. */
export type LoginResult = { ok: true; session: Session; sessionVersion?: number } | { ok: false; reason: "bad_credentials" | "disabled" };

export async function verifyCredentials(username: string, password: string): Promise<LoginResult> {
  const name = username.trim();
  if (name === env.ADMIN_USERNAME) {
    const ok = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
    return ok ? { ok: true, session: { role: "admin" } } : { ok: false, reason: "bad_credentials" };
  }
  const row = await getDb().select().from(users).where(eq(users.username, name.toLowerCase())).get();
  const ok = await verifyPassword(password, row?.passwordHash);
  if (!row || !ok) return { ok: false, reason: "bad_credentials" };
  if (row.disabledAt != null) return { ok: false, reason: "disabled" };
  return { ok: true, session: { role: "staff", userId: row.id, username: row.username }, sessionVersion: row.sessionVersion };
}

export async function createSession(result: Extract<LoginResult, { ok: true }>) {
  const { session } = result;
  const claims =
    session.role === "admin" ? { role: "admin" } : { role: "staff", sub: session.userId, sv: result.sessionVersion ?? 1 };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return getSessionFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Verifies the JWT; for staff also checks the account still exists, is not locked and has not been signed out. */
export async function getSessionFromToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  if (payload.role === "admin") return { role: "admin" };
  if (payload.role !== "staff" || typeof payload.sub !== "string") return null;
  const row = await getDb()
    .select({ username: users.username, sv: users.sessionVersion, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();
  if (!row || row.disabledAt != null || row.sv !== payload.sv) return null;
  return { role: "staff", userId: payload.sub, username: row.username };
}
