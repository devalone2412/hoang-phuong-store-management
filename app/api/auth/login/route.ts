import { z } from "zod";
import { clearSession, createSession, verifyCredentials } from "@/server/auth";
import { jsonError, readJson } from "@/server/http";

const bodySchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid", "Nhập tên đăng nhập và mật khẩu");
  const result = await verifyCredentials(parsed.data.username, parsed.data.password);
  if (!result.ok) {
    await clearSession();
    return result.reason === "disabled"
      ? jsonError(403, "disabled", "Tài khoản đã bị khóa")
      : jsonError(401, "bad_credentials", "Sai tên đăng nhập hoặc mật khẩu");
  }
  await createSession(result);
  return Response.json({ ok: true });
}
