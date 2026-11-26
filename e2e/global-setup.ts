import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { BASE_URL, cleanupE2eProducts, loggedInApi, seedE2eProducts } from "./api";

/**
 * Local dev only: the Cloudflare dev server exposes a D1 "raw" endpoint, which we use to apply
 * migrations/*.sql to the local database. Statements that were already applied are ignored.
 */
async function ensureLocalSchema() {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE_URL)) return;
  const explorer = `${BASE_URL}/cdn-cgi/local/explorer/api/d1/database`;
  const list = (await fetch(explorer).then((r) => r.json()).catch(() => null)) as { result?: { uuid?: string }[] } | null;
  const id = list?.result?.[0]?.uuid;
  if (!id) return;

  const dir = path.resolve("migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint");
    for (const sql of statements.map((s) => s.trim()).filter(Boolean)) {
      const res = await fetch(`${explorer}/${id}/raw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (res.ok && body?.success !== false) continue;
      if (/already exists|duplicate column|no such column|no such index/i.test(JSON.stringify(body))) continue;
      throw new Error(`Migration ${file} failed: ${JSON.stringify(body)}`);
    }
  }
}

export default async function globalSetup() {
  await ensureLocalSchema();
  const api = await loggedInApi();
  await cleanupE2eProducts(api); // leftovers from an interrupted run
  await seedE2eProducts(api);

  mkdirSync("e2e/.auth", { recursive: true });
  await api.storageState({ path: "e2e/.auth/state.json" });
  await api.dispose();
}
