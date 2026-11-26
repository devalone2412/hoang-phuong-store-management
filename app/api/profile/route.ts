import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { appSettings } from "@/db/schema";
import { IMAGE_KEY_RE, thumbKey } from "@/features/products/schema";
import { handler, jsonError, readJson } from "@/server/http";

const AVATAR = "admin_avatar";
const bodySchema = z.object({ avatarKey: z.string().regex(IMAGE_KEY_RE, "Ảnh không hợp lệ").nullable() });

async function currentAvatar() {
  const row = await getDb().select().from(appSettings).where(eq(appSettings.key, AVATAR)).get();
  return row?.value ?? null;
}

export const GET = handler(async () =>
  Response.json({ username: String(env.ADMIN_USERNAME ?? ""), avatarKey: await currentAvatar() }),
);

export const PUT = handler(async (req: Request) => {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid", "Ảnh không hợp lệ");
  const { avatarKey } = parsed.data;

  if (avatarKey && !(await env.IMAGES.head(avatarKey))) return jsonError(400, "invalid", "Không tìm thấy ảnh đã tải lên");

  const previous = await currentAvatar();
  await getDb()
    .insert(appSettings)
    .values({ key: AVATAR, value: avatarKey, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: avatarKey, updatedAt: Date.now() } });

  // Best effort: the old photo is only referenced from here (product photos have their own keys).
  if (previous && previous !== avatarKey) await env.IMAGES.delete([previous, thumbKey(previous)]).catch(() => {});
  return Response.json({ username: String(env.ADMIN_USERNAME ?? ""), avatarKey });
});
