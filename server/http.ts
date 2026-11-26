import { ZodError } from "zod";
import { isAuthenticated } from "./auth";
import { ConflictError } from "./products.repo";

export function jsonError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return Response.json({ error: { code, message, fields } }, { status });
}

/** Wrap a route handler: checks the session, maps Zod/conflict errors to the shared error shape. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    if (!(await isAuthenticated())) return jsonError(401, "unauthorized", "Vui lòng đăng nhập");
    try {
      return await fn(...args);
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

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
