import { getDb } from "@/db/client";
import { createUserSchema } from "@/features/users/schema";
import { handler, readJson } from "@/server/http";
import { createUser, listUsers } from "@/server/users.repo";

export const GET = handler(async () => Response.json({ items: await listUsers(getDb()) }));

export const POST = handler(async (req: Request) => {
  const data = createUserSchema.parse(await readJson(req));
  return Response.json(await createUser(getDb(), data), { status: 201 });
});
