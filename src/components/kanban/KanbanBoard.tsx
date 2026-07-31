"use client";

import { useState } from "react";
import { ORDEN_ESTADOS, type EstadoKanban, type OrdenConDetalle, type Vehiculo } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import OrdenCard from "./OrdenCard";
import NuevaOrdenForm from "./NuevaOrdenForm";
import OrdenDetalleModal from "./OrdenDetalleModal";

interface VehiculoConCliente {
  vehiculo: Vehiculo;
  clienteNombre: string;
}

export default function KanbanBoard({
  ordenesIniciales,
  vehiculosConCliente,
}: {
  ordenesIniciales: OrdenConDetalle[];
  vehiculosConCliente: VehiculoConCliente[];
}) {
  const { rol } = useRole();
  const puedeCrearOrden = rol === "Owner" || rol === "Secretary";

  const [ordenes, setOrdenes] = useState(ordenesIniciales);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [detalleAbiertoId, setDetalleAbiertoId] = useState<string | null>(null);

  async function mover(ordenId: string, direccion: 1 | -1) {
    if (!rol) return;
    const actual = ordenes.find((d) => d.orden.id === ordenId);
    if (!actual) return;

    const indiceActual = ORDEN_ESTADOS.indexOf(actual.orden.estadoKanban);
    const nuevoIndice = indiceActual + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= ORDEN_ESTADOS.length) return;
    const nuevoEstado: EstadoKanban = ORDEN_ESTADOS[nuevoIndice];

    setMoviendoId(ordenId);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoKanban: nuevoEstado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "No se pudo mover la orden.");
      }
      setOrdenes((prev) =>
        prev.map((d) => (d.orden.id === ordenId ? { ...d, orden: data } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover la orden.");
    } finally {
      setMoviendoId(null);
    }
  }

  const detalleAbierto = ordenes.find((d) => d.orden.id === detalleAbiertoId);

  return (
    <div>
      {puedeCrearOrden && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="rounded-lg bg-safety px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-safety-dark"
          >
            + Nueva Orden
          </button>
        </div>
      )}

      {mostrarForm && (
        <NuevaOrdenForm
          vehiculosConCliente={vehiculosConCliente}
          onCerrar={() => setMostrarForm(false)}
          onCreada={(detalle) => {
            setOrdenes((prev) => [detalle, ...prev]);
            setMostrarForm(false);
          }}
        />
      )}

      {detalleAbierto && (
        <OrdenDetalleModal
          detalle={detalleAbierto}
          onCerrar={() => setDetalleAbiertoId(null)}
          onActualizada={(detalle) => {
            setOrdenes((prev) => prev.map((d) => (d.orden.id === detalle.orden.id ? detalle : d)));
          }}
          onOrdenCreada={(detalle) => {
            setOrdenes((prev) => [detalle, ...prev]);
          }}
        />
      )}

      {error && (
        <p className="mb-4 rounded-md border border-stage-repuestos/30 bg-stage-repuestos/10 px-4 py-2 text-sm text-stage-repuestos">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {ORDEN_ESTADOS.map((estado) => {
          const columna = ordenes.filter((d) => d.orden.estadoKanban === estado);
          return (
            <div key={estado} className="flex min-w-0 flex-col">
              <div className="mb-3 flex items-baseline justify-between border-b-2 border-ink/10 pb-2">
                <h2 className="font-display text-xl tracking-wide text-ink">{estado}</h2>
                <span className="font-mono text-xs text-ink/40">{columna.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {columna.length === 0 && (
                  <p className="rounded-md border border-dashed border-black/15 px-3 py-6 text-center text-xs text-ink/30">
                    Sin órdenes
                  </p>
                )}
                {columna.map((detalle) => (
                  <OrdenCard
                    key={detalle.orden.id}
                    detalle={detalle}
                    moviendo={moviendoId === detalle.orden.id}
                    puedeRetroceder={ORDEN_ESTADOS.indexOf(estado) > 0}
                    puedeAvanzar={ORDEN_ESTADOS.indexOf(estado) < ORDEN_ESTADOS.length - 1}
                    onMover={(direccion) => mover(detalle.orden.id, direccion)}
                    onVerDetalle={() => setDetalleAbiertoId(detalle.orden.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
