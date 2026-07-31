"use client";

import { useState, type FormEvent } from "react";
import { useRole } from "@/lib/role-context";
import { NIVELES_COMBUSTIBLE } from "@/lib/types";
import type { OrdenConDetalle, TipoOrden, Vehiculo } from "@/lib/types";

interface VehiculoConCliente {
  vehiculo: Vehiculo;
  clienteNombre: string;
}

type Modo = "existente" | "nuevo";

const CAMPOS_VACIOS = {
  vehiculoId: "",
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  placa: "",
  marca: "",
  modelo: "",
  anio: "",
  color: "",
  diagnostico: "",
  tipoOrden: "Reparación",
  kilometraje: "",
  combustible: "",
};

export default function NuevaOrdenForm({
  vehiculosConCliente,
  onCreada,
  onCerrar,
}: {
  vehiculosConCliente: VehiculoConCliente[];
  onCreada: (detalle: OrdenConDetalle) => void;
  onCerrar: () => void;
}) {
  const { rol } = useRole();
  const [modo, setModo] = useState<Modo>("existente");
  const [campos, setCampos] = useState(CAMPOS_VACIOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizar<K extends keyof typeof CAMPOS_VACIOS>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!rol) return;
    setEnviando(true);
    setError(null);

    const body: Record<string, unknown> = {
      diagnostico: campos.diagnostico,
      tipoOrden: campos.tipoOrden as TipoOrden,
      kilometraje: campos.kilometraje ? Number(campos.kilometraje) : null,
      combustible: campos.combustible || null,
    };

    if (modo === "existente") {
      const seleccionado = vehiculosConCliente.find((v) => v.vehiculo.id === campos.vehiculoId);
      if (!seleccionado) {
        setError("Seleccione un vehículo.");
        setEnviando(false);
        return;
      }
      body.vehiculoId = seleccionado.vehiculo.id;
      body.clienteId = seleccionado.vehiculo.clienteId;
    } else {
      body.clienteNuevo = {
        nombre: campos.nombre,
        telefono: campos.telefono,
        email: campos.email,
        direccion: campos.direccion,
      };
      body.vehiculoNuevo = {
        placa: campos.placa,
        marca: campos.marca,
        modelo: campos.modelo,
        anio: Number(campos.anio),
        color: campos.color,
      };
    }

    try {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la orden.");

      const detalle: OrdenConDetalle = {
        orden: data.orden,
        vehiculo: data.vehiculo,
        cliente: data.cliente,
        cotizacion: undefined,
      };
      onCreada(detalle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la orden.");
    } finally {
      setEnviando(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink/50 focus:border-safety focus:outline-none";
  const labelClass = "text-xs font-medium uppercase tracking-wide text-ink/50";

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-10">
      <div className="animate-rise-in w-full max-w-lg rounded-xl border border-black/10 bg-paper p-4 shadow-lg sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-wide text-ink">Nueva Orden</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full px-2 py-1 text-ink/40 hover:bg-black/5 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Abre una orden en &ldquo;Ingresado&rdquo; para un vehículo existente o un cliente nuevo (walk-in).
        </p>

        <form onSubmit={enviar} className="mt-5">
          <div className="flex gap-1 rounded-lg bg-bg p-1">
            <button
              type="button"
              onClick={() => setModo("existente")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                modo === "existente" ? "bg-steel text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              Vehículo Existente
            </button>
            <button
              type="button"
              onClick={() => setModo("nuevo")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                modo === "nuevo" ? "bg-steel text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              Cliente Nuevo
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {modo === "existente" ? (
              <div className="animate-rise-in">
                <label className={labelClass}>Vehículo</label>
                <select
                  required
                  value={campos.vehiculoId}
                  onChange={(e) => actualizar("vehiculoId", e.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Seleccione una placa...</option>
                  {vehiculosConCliente.map(({ vehiculo, clienteNombre }) => (
                    <option key={vehiculo.id} value={vehiculo.id}>
                      {vehiculo.placa} — {vehiculo.marca} {vehiculo.modelo} ({clienteNombre})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="animate-rise-in space-y-3">
                <p className={labelClass}>Datos del Cliente</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Nombre completo"
                    value={campos.nombre}
                    onChange={(e) => actualizar("nombre", e.target.value)}
                    className={`${inputClass} col-span-2`}
                  />
                  <input
                    required
                    placeholder="Teléfono"
                    value={campos.telefono}
                    onChange={(e) => actualizar("telefono", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Correo electrónico"
                    value={campos.email}
                    onChange={(e) => actualizar("email", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="Dirección"
                    value={campos.direccion}
                    onChange={(e) => actualizar("direccion", e.target.value)}
                    className={`${inputClass} col-span-2`}
                  />
                </div>

                <p className={labelClass}>Datos del Vehículo</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Placa"
                    value={campos.placa}
                    onChange={(e) => actualizar("placa", e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono uppercase`}
                  />
                  <input
                    required
                    placeholder="Color"
                    value={campos.color}
                    onChange={(e) => actualizar("color", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="Marca"
                    value={campos.marca}
                    onChange={(e) => actualizar("marca", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="Modelo"
                    value={campos.modelo}
                    onChange={(e) => actualizar("modelo", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    required
                    type="number"
                    placeholder="Año"
                    value={campos.anio}
                    onChange={(e) => actualizar("anio", e.target.value)}
                    className={`${inputClass} col-span-2`}
                  />
                </div>
              </div>
            )}

            <div>
              <p className={labelClass}>Datos de Ingreso</p>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={campos.tipoOrden}
                  onChange={(e) => actualizar("tipoOrden", e.target.value)}
                  className={inputClass}
                >
                  <option value="Reparación">Reparación</option>
                  <option value="Garantía">Garantía</option>
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="Kilometraje"
                  value={campos.kilometraje}
                  onChange={(e) => actualizar("kilometraje", e.target.value)}
                  className={inputClass}
                />
                <select
                  value={campos.combustible}
                  onChange={(e) => actualizar("combustible", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Combustible...</option>
                  {NIVELES_COMBUSTIBLE.map((nivel) => (
                    <option key={nivel} value={nivel}>
                      {nivel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Diagnóstico Inicial (opcional)</label>
              <textarea
                placeholder="Motivo de ingreso o síntoma reportado..."
                value={campos.diagnostico}
                onChange={(e) => actualizar("diagnostico", e.target.value)}
                rows={2}
                className={`${inputClass} mt-1 resize-none`}
              />
            </div>

            {error && (
              <p className="rounded-md border border-stage-repuestos/30 bg-stage-repuestos/10 px-3 py-2 text-sm text-stage-repuestos">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-safety py-3 font-medium text-white transition-colors hover:bg-safety-dark disabled:opacity-50"
            >
              {enviando ? "Creando..." : "Crear Orden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
