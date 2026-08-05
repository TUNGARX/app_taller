"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";

export default function CambiarPasswordPage() {
  const [passwordActual, setPasswordActual] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword !== confirmar) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setEnviando(true);
    const res = await fetch("/api/cuenta/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordActual, nuevaPassword }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo cambiar la contraseña.");
      return;
    }

    // Sign out and require a fresh login with the new password, rather than
    // trying to hot-patch the existing JWT cookie's debeCambiarPassword flag
    // in place — simpler and avoids any race with client-side session state.
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl tracking-wide text-ink">Cambiar contraseña</h1>
      <p className="mt-2 text-sm text-ink/60">
        Por seguridad, debe establecer una nueva contraseña antes de continuar.
      </p>
      <form onSubmit={enviar} className="mt-6 space-y-3">
        <PasswordInput
          value={passwordActual}
          onChange={setPasswordActual}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        <PasswordInput
          value={nuevaPassword}
          onChange={setNuevaPassword}
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          required
          className="w-full rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        <PasswordInput
          value={confirmar}
          onChange={setConfirmar}
          placeholder="Confirmar nueva contraseña"
          autoComplete="new-password"
          required
          className="w-full rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        {error && <p className="text-xs text-safety">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-steel px-5 py-2.5 font-display text-lg tracking-wide text-white transition-colors hover:bg-safety disabled:opacity-50"
        >
          {enviando ? "Guardando..." : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}
