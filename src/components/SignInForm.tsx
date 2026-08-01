"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignInForm() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const resultado = await signIn("credentials", {
      usuario,
      password,
      redirect: false,
    });

    setEnviando(false);

    if (!resultado || resultado.error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="w-full max-w-sm">
      <div className="space-y-3">
        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuario"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm text-white placeholder:text-white/50 focus:border-safety focus:outline-none"
        />
        <div className="relative">
          <input
            type={mostrarPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 pr-11 text-center text-sm text-white placeholder:text-white/50 focus:border-safety focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setMostrarPassword((prev) => !prev)}
            aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
          >
            {mostrarPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.9 9.9 0 0112 4c5 0 9.27 3.11 11 7.5a13.5 13.5 0 01-2.16 3.19M6.6 6.6C4.6 7.9 3.02 9.9 2 11.5 3.73 15.89 8 19 12 19a9.9 9.9 0 004.24-.94" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 11.5C3.73 7.11 8 4 12 4s8.27 3.11 10 7.5C20.27 15.89 16 19 12 19s-8.27-3.11-10-7.5z" />
                <circle cx="12" cy="11.5" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-safety">{error}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-4 w-full rounded-lg bg-safety px-5 py-2.5 font-display text-lg tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
