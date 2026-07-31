import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/types";

// Augments Auth.js's built-in types so the session/JWT carry our own fields
// (verified role, username, and the forced-password-change flag) with type safety
// everywhere `auth()`/`useSession()` is used.
declare module "next-auth" {
  interface User {
    usuario: string;
    rol: Rol;
    debeCambiarPassword: boolean;
  }

  interface Session {
    user: {
      usuario: string;
      rol: Rol;
      debeCambiarPassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuario: string;
    rol: Rol;
    debeCambiarPassword: boolean;
  }
}

// The `jwt`/`session` callback signatures actually import JWT from
// "@auth/core/jwt" (next-auth/jwt just re-exports it) — augment both or the
// callback params stay untyped.
declare module "@auth/core/jwt" {
  interface JWT {
    usuario: string;
    rol: Rol;
    debeCambiarPassword: boolean;
  }
}
