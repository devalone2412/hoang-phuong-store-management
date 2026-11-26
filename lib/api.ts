export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn");
  }
  const data = (await res.json().catch(() => null)) as
    | { error?: { message?: string; fields?: Record<string, string> } }
    | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? "Có lỗi xảy ra", data?.error?.fields);
  }
  return data as T;
}
