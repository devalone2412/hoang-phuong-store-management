import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticatedRequest } from "@/server/auth";

// API routes answer 401 themselves (see server/http.ts); this guards pages only.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await isAuthenticatedRequest(req.cookies.get("hp_session")?.value);

  if (pathname === "/login") {
    return authed ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (authed) return NextResponse.next();

  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
