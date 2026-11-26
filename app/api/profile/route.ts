import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { appSettings, users } from "@/db/schema";
import { IMAGE_KEY_RE, thumbKey } from "@/features/products/schema";
import { jsonError, readJson, staffHandler } from "@/server/http";
import type { Session } from "@/server/auth";

const AVATAR = "admin_avatar";
const bodySchema = z.object({ avatarKey: z.string().regex(IMAGE_KEY_RE, "Ảnh không hợp lệ").nullable() });

async function loadProfile(session: Session) {
  const db = getDb();
  if (session.role === "admin") {
    const row = await db.select().from(appSettings).where(eq(appSettings.key, AVATAR)).get();
    return { role: "admin" as const, username: String(env.ADMIN_USERNAME ?? ""), displayName: null, avatarKey: row?.value ?? null };
  }
  const row = await db.select().from(users).where(eq(users.id, session.userId)).get();
  return { role: "staff" as const, username: session.username, displayName: row?.displayName ?? null, avatarKey: row?.avatarKey ?? null };
}

export const GET = staffHandler(async (session) => Response.json(await loadProfile(session)));

export const PUT = staffHandler(async (session, req: Request) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid", "Ảnh không hợp lệ");
  const { avatarKey } = parsed.data;

  if (avatarKey && !(await env.IMAGES.head(avatarKey))) return jsonError(400, "invalid", "Không tìm thấy ảnh đã tải lên");

  const db = getDb();
  const previous = (await loadProfile(session)).avatarKey;
  const now = Date.now();
  if (session.role === "admin") {
    await db
      .insert(appSettings)
      .values({ key: AVATAR, value: avatarKey, updatedAt: now })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: avatarKey, updatedAt: now } });
  } else {
    await db.update(users).set({ avatarKey, updatedAt: now }).where(eq(users.id, session.userId));
  }

  // Best effort: the old photo is only referenced from here (product photos have their own keys).
  if (previous && previous !== avatarKey) await env.IMAGES.delete([previous, thumbKey(previous)]).catch(() => {});
  return Response.json({ ...(await loadProfile(session)) });
});
