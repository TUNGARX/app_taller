"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignInForm() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm text-white placeholder:text-white/50 focus:border-safety focus:outline-none"
        />
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
