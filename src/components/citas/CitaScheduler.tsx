"use client";

import { useState, type FormEvent } from "react";
import { formatFecha, horasDesde } from "@/lib/format";
import type { Cita, Cliente, EstadoCita, Vehiculo } from "@/lib/types";

// A "Completada" appointment just sits in the list forever otherwise —
// drop it from view a month after its date so the list doesn't grow
// without bound. Purely a display filter, nothing is deleted.
const OCULTAR_COMPLETADA_HORAS = 24 * 30;

function estaVencida(cita: Cita): boolean {
  return cita.estado === "Completada" && horasDesde(cita.fecha, cita.hora) > OCULTAR_COMPLETADA_HORAS;
}

interface VehiculoConCliente {
  vehiculo: Vehiculo;
  clienteNombre: string;
}

interface CitaConDetalle {
  cita: Cita;
  cliente: Cliente | undefined;
  vehiculo: Vehiculo | undefined;
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
  fecha: "",
  hora: "",
  motivo: "",
};

export default function CitaScheduler({
  vehiculosConCliente,
  citasIniciales,
}: {
  vehiculosConCliente: VehiculoConCliente[];
  citasIniciales: CitaConDetalle[];
}) {
  const [modo, setModo] = useState<Modo>("existente");
  const [campos, setCampos] = useState(CAMPOS_VACIOS);
  const [citas, setCitas] = useState(citasIniciales);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  function actualizar<K extends keyof typeof CAMPOS_VACIOS>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
  }

  async function cambiarEstadoCita(citaId: string, estado: EstadoCita) {
    setActualizandoId(citaId);
    try {
      const res = await fetch(`/api/citas/${citaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar la cita.");
      setCitas((prev) => prev.map((c) => (c.cita.id === citaId ? { ...c, cita: data } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la cita.");
    } finally {
      setActualizandoId(null);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setExito(null);

    const body: Record<string, unknown> = {
      fecha: campos.fecha,
      hora: campos.hora,
      motivo: campos.motivo,
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
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo agendar la cita.");

      setCitas((prev) => [{ cita: data.cita, cliente: data.cliente, vehiculo: data.vehiculo }, ...prev]);
      setExito(`Cita agendada para ${data.vehiculo.placa} el ${formatFecha(data.cita.fecha)}.`);
      setCampos(CAMPOS_VACIOS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agendar la cita.");
    } finally {
      setEnviando(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink/50 focus:border-safety focus:outline-none";
  const labelClass = "text-xs font-medium uppercase tracking-wide text-ink/50";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form
        onSubmit={enviar}
        className="rounded-xl border border-ink/10 bg-paper p-4 shadow-sm sm:p-6"
      >
        <div className="flex gap-1 rounded-lg bg-bg p-1">
          <button
            type="button"
            onClick={() => setModo("existente")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              modo === "existente" ? "bg-steel text-white" : "text-ink/60 hover:text-ink"
            }`}
          >
            Cliente Existente
          </button>
          <button
            type="button"
            onClick={() => setModo("nuevo")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              modo === "nuevo" ? "bg-steel text-white" : "text-ink/60 hover:text-ink"
            }`}
          >
            Vehículo Nuevo
          </button>
        </div>

        <div className="mt-5 space-y-4">
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
            <div className="animate-rise-in space-y-4">
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
                  placeholder="Teléfono (8888-1234)"
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

          <p className={labelClass}>Detalles de la Cita</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              type="date"
              value={campos.fecha}
              onChange={(e) => actualizar("fecha", e.target.value)}
              className={inputClass}
            />
            <input
              required
              type="time"
              value={campos.hora}
              onChange={(e) => actualizar("hora", e.target.value)}
              className={inputClass}
            />
            <textarea
              required
              placeholder="Motivo de la visita"
              value={campos.motivo}
              onChange={(e) => actualizar("motivo", e.target.value)}
              rows={2}
              className={`${inputClass} col-span-2 resize-none`}
            />
          </div>

          {error && (
            <p className="rounded-md border border-stage-repuestos/30 bg-stage-repuestos/10 px-3 py-2 text-sm text-stage-repuestos">
              {error}
            </p>
          )}
          {exito && (
            <p className="rounded-md border border-stage-entregado/30 bg-stage-entregado/10 px-3 py-2 text-sm text-stage-entregado">
              {exito}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-safety py-3 font-medium text-white transition-colors hover:bg-safety-dark disabled:opacity-50"
          >
            {enviando ? "Agendando..." : "Agendar Cita"}
          </button>
        </div>
      </form>

      <div>
        <h2 className="font-display text-xl tracking-wide text-ink/70">Próximas Citas</h2>
        <ul className="mt-3 space-y-2">
          {citas.filter(({ cita }) => !estaVencida(cita)).map(({ cita, cliente, vehiculo }) => (
            <li
              key={cita.id}
              className="animate-rise-in rounded-lg border border-ink/10 bg-paper px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-ink">
                  {vehiculo?.placa ?? "—"}
                </span>
                <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-medium text-ink/60">
                  {cita.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/70">{cliente?.nombre ?? "Cliente"}</p>
              <p className="mt-1 text-xs text-ink/50">
                {formatFecha(cita.fecha)} · {cita.hora} — {cita.motivo}
              </p>

              {(cita.estado === "Programada" || cita.estado === "Confirmada") && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {cita.estado === "Programada" && (
                    <button
                      type="button"
                      disabled={actualizandoId === cita.id}
                      onClick={() => cambiarEstadoCita(cita.id, "Confirmada")}
                      className="rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  )}
                  {cita.estado === "Confirmada" && (
                    <button
                      type="button"
                      disabled={actualizandoId === cita.id}
                      onClick={() => cambiarEstadoCita(cita.id, "Completada")}
                      className="rounded-md bg-steel px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-safety disabled:opacity-50"
                    >
                      Marcar Completada
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actualizandoId === cita.id}
                    onClick={() => cambiarEstadoCita(cita.id, "Cancelada")}
                    className="rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium text-stage-repuestos transition-colors hover:bg-stage-repuestos/10 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
