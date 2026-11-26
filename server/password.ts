/** Password hashes look like `pbkdf2$100000$<saltB64>$<hashB64>` (see scripts/hash-password.mjs). */
const ITERATIONS = 100_000; // Workers caps PBKDF2 at 100k

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

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64.enc(salt)}$${b64.enc(hash)}`;
}

/** Always runs the KDF, even for a missing/garbled hash, so "no such user" takes as long as "wrong password". */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, iter, salt, hash] = String(stored ?? "").split("$");
  const ok = scheme === "pbkdf2" && !!iter && !!salt && !!hash;
  const derived = await pbkdf2(password, ok ? b64.dec(salt) : new Uint8Array(16), ok ? Number(iter) : ITERATIONS);
  return ok && timingSafeEqual(new Uint8Array(derived), b64.dec(hash));
}

// No 0/O, 1/l/I: the admin reads this out or types it from a screen.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Random password drawn uniformly (rejection sampling avoids modulo bias). */
export function generatePassword(length = 10): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}
