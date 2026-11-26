import { ZodError } from "zod";
import { getSession, type Session } from "./auth";
import { ConflictError } from "./products.repo";

export function jsonError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return Response.json({ error: { code, message, fields } }, { status });
}

type Role = Session["role"];

function wrap<A extends unknown[]>(roles: Role[], fn: (session: Session, ...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const session = await getSession();
    if (!session) return jsonError(401, "unauthorized", "Vui lòng đăng nhập");
    if (!roles.includes(session.role)) return jsonError(403, "forbidden", "Bạn không có quyền thực hiện thao tác này");
    try {
      return await fn(session, ...args);
    } catch (e) {
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of e.issues) fields[String(issue.path[0] ?? "_")] ??= issue.message;
        return jsonError(400, "invalid", "Dữ liệu chưa hợp lệ", fields);
      }
      if (e instanceof ConflictError) return jsonError(409, "conflict", e.message, { [e.field]: e.message });
      console.error(e);
      return jsonError(500, "server_error", "Có lỗi xảy ra, vui lòng thử lại");
    }
  };
}

/** Admin only. Routes use this unless staff explicitly need them. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return wrap<A>(["admin"], (_session, ...args) => fn(...args));
}

/** Admin or staff. Receives the session so the route can tailor its response. */
export function staffHandler<A extends unknown[]>(fn: (session: Session, ...args: A) => Promise<Response>) {
  return wrap<A>(["admin", "staff"], fn);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
