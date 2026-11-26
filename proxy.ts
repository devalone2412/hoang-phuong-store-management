import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromToken } from "@/server/auth";

const staffMayOpen = (path: string) => path === "/" || path === "/checkout" || path.startsWith("/checkout/");

// API routes answer 401/403 themselves (see server/http.ts); this guards pages only.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSessionFromToken(req.cookies.get("hp_session")?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (session) {
    const allowed = session.role === "admin" || staffMayOpen(pathname);
    return allowed ? NextResponse.next() : NextResponse.redirect(new URL("/", req.url));
  }

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
