"use client";

import { createContext, useContext, type ReactNode } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import type { Rol } from "@/lib/types";

export const ROLE_LABEL: Record<Rol, string> = {
  Owner: "Dueño",
  Secretary: "Secretaria",
  Mechanic: "Mecánico",
};

interface RoleContextValue {
  rol: Rol | null;
  /** The worker's own name, verified via the signed-in Auth.js session — no
   *  longer something a client can type in and claim. Falls back to the role
   *  label (via nombreMostrado) when the account has no display name. */
  nombre: string;
  cerrarSesion: () => void;
  /** True once the Auth.js session has finished loading — avoids a flash of
   *  the wrong UI before we know whether the user is signed in. */
  listo: boolean;
  /** True if this account must set a new password (Owner-forced reset, or
   *  the current password is older than 90 days) before using the app. */
  debeCambiarPassword: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function RoleContextBridge({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const value: RoleContextValue = {
    rol: session?.user?.rol ?? null,
    nombre: session?.user?.name ?? "",
    listo: status !== "loading",
    debeCambiarPassword: session?.user?.debeCambiarPassword ?? false,
    cerrarSesion: () => {
      void signOut({ callbackUrl: "/" });
    },
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RoleContextBridge>{children}</RoleContextBridge>
    </SessionProvider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de <RoleProvider>.");
  return ctx;
}

/** The name to attribute an action to: the account's own name if set,
 *  otherwise its role label (e.g. "Mecánico") as a safe fallback. */
export function nombreMostrado(nombre: string, rol: Rol): string {
  return nombre.trim() || ROLE_LABEL[rol];
}
