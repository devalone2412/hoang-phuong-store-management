import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "hp_session";
const SESSION_DAYS = 7;

const key = () => new TextEncoder().encode(env.SESSION_SECRET);

/** Password hashes look like `pbkdf2$100000$<saltB64>$<hashB64>` (see scripts/hash-password.mjs). */
const b64 = {
  enc: (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))),
  dec: (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = String(env.ADMIN_PASSWORD_HASH ?? "").split("$");
  // Always run the KDF so a wrong username takes as long as a wrong password.
  const ok = scheme === "pbkdf2" && !!iter && !!salt && !!hash;
  const derived = await pbkdf2(password, ok ? b64.dec(salt) : new Uint8Array(16), ok ? Number(iter) : 100_000);
  const userOk = username === env.ADMIN_USERNAME;
  return ok && userOk && timingSafeEqual(new Uint8Array(derived), b64.dec(hash));
}

export async function createSession() {
  const token = await new SignJWT({ role: "admin" })
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

export async function isAuthenticated(): Promise<boolean> {
  return isAuthenticatedRequest((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function isAuthenticatedRequest(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
