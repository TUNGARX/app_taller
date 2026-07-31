"use client";

import { diasDesde, formatColones } from "@/lib/format";
import { STAGE_BORDER } from "@/lib/kanban-colors";
import { useRole } from "@/lib/role-context";
import type { OrdenConDetalle } from "@/lib/types";

export default function OrdenCard({
  detalle,
  onMover,
  onVerDetalle,
  puedeRetroceder,
  puedeAvanzar,
  moviendo,
}: {
  detalle: OrdenConDetalle;
  onMover: (direccion: 1 | -1) => void;
  onVerDetalle: () => void;
  puedeRetroceder: boolean;
  puedeAvanzar: boolean;
  moviendo: boolean;
}) {
  const { rol } = useRole();
  const puedeVerPrecios = rol !== "Mechanic";
  const { orden, vehiculo, cliente, cotizacion } = detalle;
  const dias = diasDesde(orden.fechaIngreso);

  return (
    <div
      className={`animate-rise-in rounded-lg border border-ink/10 border-l-4 bg-paper p-3 shadow-sm transition-opacity ${
        STAGE_BORDER[orden.estadoKanban]
      } ${moviendo ? "opacity-40" : "opacity-100"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onVerDetalle}
          className="rounded border border-steel-light bg-steel px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-white transition-colors hover:bg-safety"
        >
          {vehiculo.placa}
        </button>
        <div className="flex items-center gap-1">
          {orden.tipoOrden === "Garantía" && (
            <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-semibold text-white">
              Garantía
            </span>
          )}
          <span className="font-mono text-[10px] text-ink/40">
            {dias === 0 ? "hoy" : `${dias}d`}
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm font-semibold text-ink">
        {vehiculo.marca} {vehiculo.modelo} · {vehiculo.anio}
      </p>
      <p className="text-xs text-ink/60">{cliente.nombre}</p>

      {orden.diagnostico && (
        <p className="mt-2 line-clamp-2 text-xs text-ink/70">{orden.diagnostico}</p>
      )}

      {cotizacion && puedeVerPrecios && (
        <p className="mt-2 font-mono text-xs text-ink/50">
          {formatColones(cotizacion.total)}
          {cotizacion.estado === "Pendiente" && (
            <span className="ml-1 text-amber">(pendiente de decisión)</span>
          )}
          {cotizacion.estado === "Rechazada" && (
            <span className="ml-1 text-stage-repuestos">(rechazada)</span>
          )}
          {cotizacion.estado === "Aprobada" && !cotizacion.pagada && (
            <span className="ml-1 text-amber">(pendiente de pago)</span>
          )}
        </p>
      )}

      {orden.actividad.length > 0 && (
        <p className="mt-2 text-[10px] text-ink/40">
          Última actividad: {orden.actividad[orden.actividad.length - 1].autor}
        </p>
      )}

      <button
        type="button"
        onClick={onVerDetalle}
        className="mt-2 text-xs font-medium text-ink/40 underline-offset-2 hover:text-safety hover:underline"
      >
        Ver detalle / cotización / fotos
      </button>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMover(-1)}
          disabled={!puedeRetroceder || moviendo}
          className="rounded px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 disabled:opacity-20"
        >
          ‹ Anterior
        </button>
        <button
          type="button"
          onClick={() => onMover(1)}
          disabled={!puedeAvanzar || moviendo}
          className="rounded bg-steel px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-safety disabled:opacity-20"
        >
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
