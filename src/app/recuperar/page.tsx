"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function RecuperarPage() {
  const [usuario, setUsuario] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword !== confirmar) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setEnviando(true);
    const res = await fetch("/api/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, codigo, nuevaPassword }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setExito(true);
  }

  const inputClass =
    "w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm text-white placeholder:text-white/50 focus:border-safety focus:outline-none";

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-steel px-6 py-16 text-white">
      <div className="hazard-strip absolute top-0 h-1.5 w-full" />

      <div className="w-full max-w-sm">
        <p className="text-center font-mono text-xs uppercase tracking-[0.35em] text-white/40">
          Automotivo
        </p>
        <h1 className="mt-3 text-center font-display text-3xl tracking-wide">
          Recuperar Contraseña
        </h1>

        {exito ? (
          <div className="mt-6 rounded-lg border border-stage-entregado/30 bg-stage-entregado/10 p-4 text-center text-sm">
            <p>Contraseña restablecida correctamente.</p>
            <Link
              href="/"
              className="mt-3 inline-block font-medium text-white underline-offset-2 hover:underline"
            >
              Ir a Ingresar
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-center text-sm text-white/60">
              Ingrese su usuario y uno de sus códigos de recuperación (entregados al crear la
              cuenta, o por el dueño del taller) para definir una nueva contraseña.
            </p>

            <form onSubmit={enviar} className="mt-6 space-y-3">
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Usuario"
                autoComplete="username"
                required
                className={inputClass}
              />
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de recuperación (ej. AB12-CD34)"
                required
                className={`${inputClass} font-mono uppercase tracking-widest`}
              />
              <PasswordInput
                value={nuevaPassword}
                onChange={setNuevaPassword}
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                autoComplete="new-password"
                required
                className={inputClass}
                iconClassName="text-white/50 hover:text-white"
              />
              <PasswordInput
                value={confirmar}
                onChange={setConfirmar}
                placeholder="Confirmar nueva contraseña"
                autoComplete="new-password"
                required
                className={inputClass}
                iconClassName="text-white/50 hover:text-white"
              />

              {error && <p className="text-center text-xs text-safety">{error}</p>}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-safety px-5 py-2.5 font-display text-lg tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? "Restableciendo..." : "Restablecer Contraseña"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm text-white/50 underline-offset-2 hover:text-white hover:underline"
              >
                ← Volver a Ingresar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
