"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ORDEN_ESTADOS, type EstadoKanban, type OrdenConDetalle, type Vehiculo } from "@/lib/types";
import { horasDesde } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import OrdenCard from "./OrdenCard";
import NuevaOrdenForm from "./NuevaOrdenForm";
import OrdenDetalleModal from "./OrdenDetalleModal";

interface VehiculoConCliente {
  vehiculo: Vehiculo;
  clienteNombre: string;
}

// Delivered cards older than this just clutter the board for day-to-day use
// (the shop asked for this specifically) — they're hidden by default but
// never deleted, and can always be revealed again via the toggle below.
const OCULTAR_ENTREGADO_HORAS = 72;

function estaArchivada(detalle: OrdenConDetalle): boolean {
  const { orden } = detalle;
  if (orden.estadoKanban !== "Entregado" || !orden.fechaEntrega) return false;
  return horasDesde(orden.fechaEntrega, orden.horaSalida) > OCULTAR_ENTREGADO_HORAS;
}

/** A Kanban column as a drop target — highlights while a card is dragged
 *  over it. The Anterior/Siguiente buttons on each card still work exactly
 *  as before; drag-and-drop is an additional, faster way to move a card,
 *  not a replacement (touch drag is more error-prone, so the buttons stay
 *  as the reliable fallback on phones). */
function ColumnaSoltable({
  estado,
  children,
}: {
  estado: EstadoKanban;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-0 flex-col rounded-lg transition-colors ${
        isOver ? "bg-safety/5 ring-2 ring-safety/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

/** Wraps a card to make it draggable between columns. Uses a distance-based
 *  activation for mouse (so a plain click still reaches the card's own
 *  buttons) and a delay-based one for touch (so it doesn't hijack scrolling
 *  a column on a phone) — configured on the sensors in KanbanBoard. */
function TarjetaArrastrable({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={disabled ? undefined : `cursor-grab touch-none active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </div>
  );
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
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);

  // distance: a plain click/tap on a card's own buttons never travels 8px,
  // so it still reaches them normally — only a deliberate drag activates.
  // The touch delay additionally gives a quick scroll swipe time to happen
  // before a press is treated as a drag, instead of hijacking it instantly.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const terminoBusqueda = busqueda.trim().toLowerCase();
  const hayBusqueda = terminoBusqueda.length > 0;

  function coincide(detalle: OrdenConDetalle): boolean {
    return detalle.vehiculo.placa.toLowerCase().includes(terminoBusqueda);
  }

  async function actualizarEstado(ordenId: string, nuevoEstado: EstadoKanban) {
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

  function mover(ordenId: string, direccion: 1 | -1) {
    const actual = ordenes.find((d) => d.orden.id === ordenId);
    if (!actual) return;

    const indiceActual = ORDEN_ESTADOS.indexOf(actual.orden.estadoKanban);
    const nuevoIndice = indiceActual + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= ORDEN_ESTADOS.length) return;
    actualizarEstado(ordenId, ORDEN_ESTADOS[nuevoIndice]);
  }

  function alSoltar(event: DragEndEvent) {
    setArrastrandoId(null);
    const { active, over } = event;
    if (!over) return;
    const nuevoEstado = over.id as EstadoKanban;
    const detalle = ordenes.find((d) => d.orden.id === active.id);
    if (!detalle || detalle.orden.estadoKanban === nuevoEstado) return;
    actualizarEstado(active.id as string, nuevoEstado);
  }

  const detalleAbierto = ordenes.find((d) => d.orden.id === detalleAbiertoId);
  const detalleArrastrando = arrastrandoId ? ordenes.find((d) => d.orden.id === arrastrandoId) : undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <div className="relative min-w-0 flex-1 sm:flex-none sm:w-56">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por placa..."
            className="w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 pr-7 font-mono text-sm placeholder:font-sans placeholder:text-ink/40 focus:border-safety focus:outline-none"
          />
          {hayBusqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
        {puedeCrearOrden && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="rounded-lg bg-safety px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-safety-dark"
          >
            + Nueva Orden
          </button>
        )}
      </div>

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

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setArrastrandoId(e.active.id as string)}
        onDragEnd={alSoltar}
        onDragCancel={() => setArrastrandoId(null)}
      >
        <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {ORDEN_ESTADOS.map((estado) => {
            const columnaCompleta = ordenes.filter((d) => d.orden.estadoKanban === estado);
            const esEntregado = estado === "Entregado";
            const archivadas = esEntregado ? columnaCompleta.filter(estaArchivada) : [];
            // While searching, matching archived cards surface even if the
            // "mostrar archivadas" toggle is off — no need to reveal the whole
            // pile of old deliveries just to find one plate.
            const columna =
              esEntregado && !mostrarArchivadas
                ? columnaCompleta.filter((d) => !estaArchivada(d) || (hayBusqueda && coincide(d)))
                : columnaCompleta;

            return (
              <ColumnaSoltable key={estado} estado={estado}>
                <div className="mb-3 flex items-baseline justify-between border-b-2 border-ink/10 pb-2">
                  <h2 className="font-display text-xl tracking-wide text-ink">{estado}</h2>
                  <span className="font-mono text-xs text-ink/40">{columna.length}</span>
                </div>

                {esEntregado && archivadas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarArchivadas((prev) => !prev)}
                    className="mb-3 rounded-md border border-dashed border-ink/20 px-2 py-1.5 text-center text-[11px] font-medium text-ink/50 transition-colors hover:border-safety hover:text-ink"
                  >
                    {mostrarArchivadas
                      ? "Ocultar entregas antiguas"
                      : `+${archivadas.length} entregadas hace +72h — Mostrar`}
                  </button>
                )}

                <div className="flex flex-col gap-3">
                  {columna.length === 0 && (
                    <p className="rounded-md border border-dashed border-ink/15 px-3 py-6 text-center text-xs text-ink/30">
                      Sin órdenes
                    </p>
                  )}
                  {columna.map((detalle) => (
                    <TarjetaArrastrable
                      key={detalle.orden.id}
                      id={detalle.orden.id}
                      disabled={moviendoId === detalle.orden.id}
                    >
                      <OrdenCard
                        detalle={detalle}
                        moviendo={moviendoId === detalle.orden.id}
                        puedeRetroceder={ORDEN_ESTADOS.indexOf(estado) > 0}
                        puedeAvanzar={ORDEN_ESTADOS.indexOf(estado) < ORDEN_ESTADOS.length - 1}
                        onMover={(direccion) => mover(detalle.orden.id, direccion)}
                        onVerDetalle={() => setDetalleAbiertoId(detalle.orden.id)}
                        archivada={estaArchivada(detalle)}
                        resaltada={hayBusqueda && coincide(detalle)}
                        atenuada={hayBusqueda && !coincide(detalle)}
                        onVolverAIngresado={
                          estaArchivada(detalle)
                            ? () => actualizarEstado(detalle.orden.id, "Ingresado")
                            : undefined
                        }
                      />
                    </TarjetaArrastrable>
                  ))}
                </div>
              </ColumnaSoltable>
            );
          })}
        </div>

        <DragOverlay>
          {detalleArrastrando ? (
            <div className="w-full max-w-[220px] cursor-grabbing rounded-lg border border-safety bg-paper p-3 shadow-lg">
              <span className="rounded border border-steel-light bg-steel px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-white">
                {detalleArrastrando.vehiculo.placa}
              </span>
              <p className="mt-1 text-sm font-semibold text-ink">
                {detalleArrastrando.vehiculo.marca} {detalleArrastrando.vehiculo.modelo}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
