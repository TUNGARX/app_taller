"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import StaffNav from "@/components/StaffNav";
import { useRole } from "@/lib/role-context";

const RUTA_CAMBIAR_PASSWORD = "/cambiar-password";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { rol, listo, debeCambiarPassword } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!listo) return;
    if (!rol) {
      router.replace("/");
      return;
    }
    if (debeCambiarPassword && pathname !== RUTA_CAMBIAR_PASSWORD) {
      router.replace(RUTA_CAMBIAR_PASSWORD);
    }
  }, [listo, rol, debeCambiarPassword, pathname, router]);

  const redirigiendo =
    !listo || !rol || (debeCambiarPassword && pathname !== RUTA_CAMBIAR_PASSWORD);

  if (redirigiendo) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StaffNav />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
