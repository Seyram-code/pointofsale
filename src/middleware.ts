import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "mypos_session";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/activate",
  "/reset-password",
  "/plans",
  "/privacy-policy",
  "/terms",
  "/forbidden",
  "/offline",
  "/robots.txt",
  "/sitemap.xml",
  "/google5768b6cf2a0bb144.html",
  "/sw.js",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/activate-shop",
  "/api/auth/resend-shop-activation",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/health",
  "/api/cron/reconcile-payments",
  // Provider callbacks authenticate by signature, not by session.
  "/api/payments/webhook",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Edge-level gate. Only verifies the cookie signature and expiry — full
 * session/permission validation happens server-side via `getSession`.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const claims = token ? await verifySessionToken(token) : null;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mypo-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|pdf)$).*)"],
};
