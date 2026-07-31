import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the auth config — used only by middleware.ts, which
// runs in the Edge runtime and cannot load native modules (better-sqlite3)
// or Node's `fs`. It has no providers (middleware never calls `authorize()`,
// only the real sign-in POST route does, which runs in Node) and no
// DB-touching callbacks — it just verifies/decodes the JWT cookie using the
// shared secret. The full config in `src/auth.ts` spreads this and adds the
// Credentials provider + DB-backed callbacks for actual sign-in.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
