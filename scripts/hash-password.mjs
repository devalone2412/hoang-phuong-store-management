// Usage: node scripts/hash-password.mjs 'your-password'
// Prints a value for ADMIN_PASSWORD_HASH (put it in .dev.vars locally, or upload it as a secret).
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs '<password>'");
  process.exit(1);
}
const iterations = 100_000; // keep in sync with server/auth.ts (Workers caps PBKDF2 at 100k)
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(`pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`);
