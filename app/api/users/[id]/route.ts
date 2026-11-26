import { getDb } from "@/db/client";
import { updateUserSchema } from "@/features/users/schema";
import { handler, jsonError, readJson } from "@/server/http";
import { deleteUser, updateUser } from "@/server/users.repo";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const data = updateUserSchema.parse(await readJson(req));
  const user = await updateUser(getDb(), (await params).id, data);
  return user ? Response.json(user) : jsonError(404, "not_found", "Không tìm thấy thành viên");
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) =>
  (await deleteUser(getDb(), (await params).id))
    ? Response.json({ ok: true })
    : jsonError(404, "not_found", "Không tìm thấy thành viên"),
);
