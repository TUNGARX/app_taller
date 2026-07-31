"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRole } from "@/lib/role-context";
import type { Rol } from "@/lib/types";

export default function RoleGuard({ allow, children }: { allow: Rol[]; children: ReactNode }) {
  const { rol } = useRole();

  if (rol && !allow.includes(rol)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg px-6 py-20 text-center">
        <p className="font-display text-2xl text-ink">Sección no disponible para su rol</p>
        <p className="mt-2 text-sm text-ink/60">
          Esta parte del sistema está reservada para otro rol de personal.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 rounded-lg bg-steel px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-safety"
        >
          Volver al Panel
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
