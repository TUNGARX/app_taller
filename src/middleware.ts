import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance — built from the DB-free config, not the full
// `@/auth` (which pulls in better-sqlite3/fs and cannot run in Edge
// middleware). It can still verify/decode the JWT cookie via the shared
// secret; it just never calls `authorize()`.
const { auth } = NextAuth(authConfig);

// Explicit allow-list of unauthenticated routes. Anything not matched here is
// protected by default — safer than an allow-everything-except-list, since a
// route added later and forgotten here stays protected rather than silently
// open.
const PUBLIC_PATHS = [
  /^\/$/, // landing page / sign-in
  /^\/buscar(\/.*)?$/, // public plate-lookup portal
  /^\/api\/auth(\/.*)?$/, // Auth.js's own sign-in/session endpoints
  /^\/api\/vehiculos$/, // plate lookup used by /buscar — exact path only,
  // NOT /api/vehiculos/[id]/historial, which is staff-only
];

function esPublica(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (esPublica(pathname)) return NextResponse.next();

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const url = new URL("/", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
