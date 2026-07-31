"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import SignInForm from "./SignInForm";

/** Shows the sign-in form, or redirects straight to the dashboard if the
 *  visitor already has a valid session — nobody should see a login form
 *  they're already past. */
export default function IngresoPanel() {
  const { rol, listo } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (listo && rol) {
      router.replace("/dashboard");
    }
  }, [listo, rol, router]);

  if (!listo || rol) {
    return (
      <p className="font-mono text-xs uppercase tracking-widest text-white/40">
        Cargando...
      </p>
    );
  }

  return <SignInForm />;
}
