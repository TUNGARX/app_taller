"use client";

import { useState, type FormEvent } from "react";
import { STAGE_BG } from "@/lib/kanban-colors";
import { formatColones, formatFecha } from "@/lib/format";
import DescargarCotizacionPdfButton from "@/components/kanban/DescargarCotizacionPdfButton";
import type { Cliente, Cotizacion, OrdenTrabajo, Vehiculo } from "@/lib/types";

interface OrdenConCotizacion {
  orden: OrdenTrabajo;
  cotizacion: Cotizacion | undefined;
}

interface Resultado {
  vehiculo: Vehiculo;
  cliente: Cliente;
  ordenes: OrdenConCotizacion[];
}

export default function BuscarPage() {
  const [placa, setPlaca] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (!placa.trim()) return;

    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch(`/api/vehiculos?placa=${encodeURIComponent(placa)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo completar la búsqueda.");
      setResultado(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la búsqueda.");
    } finally {
      setCargando(false);
    }
  }

  const ordenActual = resultado?.ordenes[0];

  return (
    <div className="flex flex-1 flex-col items-center bg-bg px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide text-ink">
            Consultar mi Vehículo
          </h1>
          <p className="mt-2 text-ink/60">
            Ingrese el número de placa para ver el estado y el historial de servicio.
          </p>
        </div>

        <form onSubmit={buscar} className="mt-8 flex gap-2">
          <input
            type="text"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            placeholder="Placa (ej. BPP123)"
            className="flex-1 rounded-lg border border-black/15 bg-paper px-4 py-3 text-center font-mono text-lg uppercase tracking-widest text-ink placeholder:text-ink/50 focus:border-safety focus:outline-none"
          />
          <button
            type="submit"
            disabled={cargando}
            className="rounded-lg bg-steel px-6 py-3 font-medium text-white transition-colors hover:bg-safety disabled:opacity-50"
          >
            {cargando ? "..." : "Buscar"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md border border-stage-repuestos/30 bg-stage-repuestos/10 px-4 py-3 text-center text-sm text-stage-repuestos animate-rise-in">
            {error}
          </p>
        )}

        {resultado && (
          <div className="mt-8 animate-rise-in">
            <div className="rounded-xl border border-black/10 bg-paper p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded border border-ink/20 bg-ink px-3 py-1 font-mono text-base font-semibold tracking-wider text-white">
                  {resultado.vehiculo.placa}
                </span>
                {ordenActual && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                      STAGE_BG[ordenActual.orden.estadoKanban]
                    }`}
                  >
                    {ordenActual.orden.estadoKanban}
                  </span>
                )}
              </div>

              <p className="mt-3 font-display text-2xl tracking-wide text-ink">
                {resultado.vehiculo.marca} {resultado.vehiculo.modelo} · {resultado.vehiculo.anio}
              </p>
              <p className="text-sm text-ink/60">
                {resultado.vehiculo.color} · Propietario: {resultado.cliente.nombre}
              </p>

              {ordenActual?.orden.diagnostico && (
                <p className="mt-4 rounded-md bg-bg px-4 py-3 text-sm text-ink/80">
                  {ordenActual.orden.diagnostico}
                </p>
              )}

              {ordenActual?.cotizacion && (
                <p className="mt-3 font-mono text-sm text-ink/60">
                  {ordenActual.cotizacion.pagada ? "Factura" : "Orden"}:{" "}
                  {formatColones(ordenActual.cotizacion.total)}{" "}
                  {ordenActual.cotizacion.pagada ? (
                    <span className="text-stage-entregado">(pagada)</span>
                  ) : ordenActual.cotizacion.estado === "Aprobada" ? (
                    <span className="text-amber">(aprobada, pendiente de pago)</span>
                  ) : ordenActual.cotizacion.estado === "Rechazada" ? (
                    <span className="text-stage-repuestos">(rechazada)</span>
                  ) : (
                    <span className="text-amber">(pendiente de aprobación)</span>
                  )}
                </p>
              )}

              {ordenActual?.cotizacion?.estado === "Aprobada" && ordenActual.cotizacion.pagada && (
                <div className="mt-3">
                  <DescargarCotizacionPdfButton
                    cotizacion={ordenActual.cotizacion}
                    orden={ordenActual.orden}
                    vehiculo={resultado.vehiculo}
                    cliente={resultado.cliente}
                  />
                </div>
              )}

              {ordenActual && ordenActual.orden.fotos.length > 0 && (
                <div className="mt-4 border-t border-black/10 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
                    Fotos de Evidencia
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ordenActual.orden.fotos.map((foto, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={foto}
                        alt={`Evidencia ${i + 1}`}
                        className="h-20 w-20 rounded-md border border-black/10 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {resultado.ordenes.length > 1 && (
              <div className="mt-6">
                <h2 className="font-display text-lg tracking-wide text-ink/70">
                  Historial de Servicio
                </h2>
                <ul className="mt-3 space-y-2">
                  {resultado.ordenes.slice(1).map(({ orden, cotizacion }) => (
                    <li
                      key={orden.id}
                      className="rounded-md border border-black/10 bg-paper px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-ink/80">{orden.diagnostico || "Sin diagnóstico registrado"}</p>
                          <p className="mt-0.5 font-mono text-xs text-ink/40">
                            {formatFecha(orden.fechaIngreso)}
                          </p>
                        </div>
                        {cotizacion && (
                          <span className="font-mono text-xs text-ink/50">
                            {formatColones(cotizacion.total)}
                          </span>
                        )}
                      </div>

                      {cotizacion?.estado === "Aprobada" && cotizacion.pagada && (
                        <div className="mt-2">
                          <DescargarCotizacionPdfButton
                            cotizacion={cotizacion}
                            orden={orden}
                            vehiculo={resultado.vehiculo}
                            cliente={resultado.cliente}
                          />
                        </div>
                      )}

                      {orden.fotos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {orden.fotos.map((foto, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={foto}
                              alt={`Evidencia ${i + 1}`}
                              className="h-16 w-16 rounded-md border border-black/10 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
