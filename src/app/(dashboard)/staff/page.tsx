"use client";

import { useEffect, useState } from "react";
import { useRole, ROLE_LABEL } from "@/lib/role-context";
import type { Rol } from "@/lib/types";

interface UsuarioListado {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  debeCambiarPassword: 0 | 1;
  createdAt: string;
}

const ROLES: Rol[] = ["Owner", "Secretary", "Mechanic"];

export default function StaffPage() {
  const { rol } = useRole();
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [cargando, setCargando] = useState(true);

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState<Rol>("Secretary");
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const [reiniciarId, setReiniciarId] = useState<number | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState("");
  const [reiniciando, setReiniciando] = useState(false);
  const [avisoReinicio, setAvisoReinicio] = useState<string | null>(null);

  const [eliminarId, setEliminarId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function cargarUsuarios() {
    setCargando(true);
    const res = await fetch("/api/staff");
    if (res.ok) setUsuarios(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    // Fetching on mount/role-change is the standard "sync with an external
    // system" case this rule allows — the resulting setState happens inside
    // the async callback, not synchronously in the effect body itself.
    if (rol === "Owner") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarUsuarios();
    }
  }, [rol]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreando(true);

    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password, nombre, rol: nuevoRol }),
    });
    const data = await res.json();
    setCreando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el usuario.");
      return;
    }

    setUsuario("");
    setPassword("");
    setNombre("");
    setNuevoRol("Secretary");
    cargarUsuarios();
  }

  async function reiniciar(id: number) {
    setReiniciando(true);
    setAvisoReinicio(null);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, passwordTemporal }),
    });
    const data = await res.json();
    setReiniciando(false);

    if (!res.ok) {
      setAvisoReinicio(data.error ?? "No se pudo reiniciar la contraseña.");
      return;
    }

    setAvisoReinicio("Contraseña reiniciada. El usuario deberá cambiarla al ingresar.");
    setReiniciarId(null);
    setPasswordTemporal("");
  }

  async function eliminar(id: number) {
    setEliminando(true);
    setErrorEliminar(null);
    const res = await fetch("/api/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setEliminando(false);

    if (!res.ok) {
      setErrorEliminar(data.error ?? "No se pudo eliminar la cuenta.");
      return;
    }

    setEliminarId(null);
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
  }

  if (rol !== "Owner") {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <p className="text-sm text-ink/60">
          Solo el dueño puede administrar el personal.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl tracking-wide text-ink">Personal</h1>
      <p className="mt-1 text-sm text-ink/60">
        Cree cuentas para nuevos empleados y reinicie contraseñas cuando sea necesario.
      </p>

      <form onSubmit={crear} className="mt-8 grid grid-cols-1 gap-3 rounded-lg border border-ink/10 bg-paper p-5 sm:grid-cols-2">
        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuario (ej. carlos.mora)"
          required
          className="rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre completo"
          required
          className="rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña temporal (mínimo 8 caracteres)"
          required
          className="rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm placeholder:text-ink/50 focus:border-safety focus:outline-none"
        />
        <select
          value={nuevoRol}
          onChange={(e) => setNuevoRol(e.target.value as Rol)}
          className="rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm focus:border-safety focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>

        {error && <p className="sm:col-span-2 text-xs text-safety">{error}</p>}

        <button
          type="submit"
          disabled={creando}
          className="sm:col-span-2 rounded-lg bg-steel px-5 py-2.5 font-display text-lg tracking-wide text-white transition-colors hover:bg-safety disabled:opacity-50"
        >
          {creando ? "Creando..." : "Crear cuenta"}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="font-display text-xl tracking-wide text-ink/80">Cuentas existentes</h2>
        {avisoReinicio && <p className="mt-2 text-xs text-ink/70">{avisoReinicio}</p>}

        {cargando ? (
          <p className="mt-3 text-sm text-ink/40">Cargando...</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {usuarios.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-paper p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {u.nombre} <span className="font-mono text-xs text-ink/40">({u.usuario})</span>
                  </p>
                  <p className="text-xs text-ink/50">
                    {ROLE_LABEL[u.rol]}
                    {u.debeCambiarPassword ? " · debe cambiar contraseña" : ""}
                  </p>
                </div>

                {reiniciarId === u.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={passwordTemporal}
                      onChange={(e) => setPasswordTemporal(e.target.value)}
                      placeholder="Nueva contraseña temporal"
                      className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-3 py-1.5 text-xs focus:border-safety focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={reiniciando}
                      onClick={() => reiniciar(u.id)}
                      className="rounded-md bg-steel px-3 py-1.5 text-xs font-medium text-white hover:bg-safety disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReiniciarId(null);
                        setPasswordTemporal("");
                      }}
                      className="text-xs text-ink/40 hover:text-ink/70"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : eliminarId === u.id ? (
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-stage-repuestos">
                        ¿Eliminar a {u.nombre}?
                      </span>
                      <button
                        type="button"
                        disabled={eliminando}
                        onClick={() => eliminar(u.id)}
                        className="rounded-md bg-stage-repuestos px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {eliminando ? "Eliminando..." : "Sí, eliminar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEliminarId(null);
                          setErrorEliminar(null);
                        }}
                        className="text-xs text-ink/40 hover:text-ink/70"
                      >
                        Cancelar
                      </button>
                    </div>
                    {errorEliminar && <p className="text-xs text-stage-repuestos">{errorEliminar}</p>}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReiniciarId(u.id)}
                      className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 hover:border-safety hover:text-ink"
                    >
                      Reiniciar contraseña
                    </button>
                    <button
                      type="button"
                      onClick={() => setEliminarId(u.id)}
                      className="rounded-md border border-stage-repuestos/30 px-3 py-1.5 text-xs font-medium text-stage-repuestos hover:bg-stage-repuestos/10"
                    >
                      Eliminar cuenta
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-ink/10 bg-paper p-5">
        <h2 className="font-display text-xl tracking-wide text-ink/80">Respaldo de Datos</h2>
        <p className="mt-1 text-sm text-ink/60">
          Descargue una copia de todos los datos del taller (clientes, vehículos, citas, órdenes
          y cotizaciones) en un archivo .zip. Guárdelo en un lugar seguro, como su Google Drive,
          como respaldo.
        </p>
        <a
          href="/api/backup/exportar"
          className="mt-4 inline-block rounded-lg bg-steel px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-safety"
        >
          Descargar respaldo (.zip)
        </a>
      </div>
    </div>
  );
}
