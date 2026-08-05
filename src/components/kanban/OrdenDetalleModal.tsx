"use client";

import { useEffect, useState } from "react";
import { calcularTotalesCotizacion } from "@/lib/cotizacion-calc";
import { formatColones, formatFecha } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import type { Cotizacion, CotizacionItem, OrdenConDetalle, TipoOrden } from "@/lib/types";

/** The 4 states a Cotización's estado+pagada pair actually represents to a
 *  human — "Pagada" and "Aprobada, pendiente de pago" are both `estado:
 *  "Aprobada"` under the hood, differing only in `pagada`. */
type EstadoCombinado = "Pendiente" | "Aprobada" | "Pagada" | "Rechazada";

function estadoCombinadoDe(cotizacion: Cotizacion): EstadoCombinado {
  if (cotizacion.estado !== "Aprobada") return cotizacion.estado;
  return cotizacion.pagada ? "Pagada" : "Aprobada";
}
import DescargarCotizacionPdfButton from "./DescargarCotizacionPdfButton";

const LINEA_VACIA: CotizacionItem = {
  descripcion: "",
  cantidad: 1,
  precioUnitario: 0,
  tipo: "Repuesto",
};

interface HistorialEntrada {
  orden: OrdenConDetalle["orden"];
  cotizacion: OrdenConDetalle["cotizacion"];
}

export default function OrdenDetalleModal({
  detalle,
  onCerrar,
  onActualizada,
  onOrdenCreada,
}: {
  detalle: OrdenConDetalle;
  onCerrar: () => void;
  onActualizada: (detalle: OrdenConDetalle) => void;
  onOrdenCreada?: (detalle: OrdenConDetalle) => void;
}) {
  const { rol } = useRole();
  const puedeFacturar = rol === "Owner" || rol === "Secretary";
  const puedeFotografiar = rol === "Owner" || rol === "Mechanic";
  const puedeVerPrecios = rol !== "Mechanic";

  const { orden, vehiculo, cliente, cotizacion } = detalle;
  const esFactura = cotizacion?.estado === "Aprobada" && cotizacion?.pagada;

  const [items, setItems] = useState<CotizacionItem[]>(
    cotizacion && cotizacion.items.length > 0 ? cotizacion.items : [{ ...LINEA_VACIA }]
  );
  const [enviandoCotizacion, setEnviandoCotizacion] = useState(false);
  const [enviandoItems, setEnviandoItems] = useState(false);
  const [enviandoDecision, setEnviandoDecision] = useState(false);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [seguimientoChecked, setSeguimientoChecked] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notaTexto, setNotaTexto] = useState("");
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [notas, setNotas] = useState(orden.notas);
  const [actividad, setActividad] = useState(orden.actividad);

  const [historial, setHistorial] = useState<HistorialEntrada[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const [mostrarReabrir, setMostrarReabrir] = useState(false);
  const [tipoReapertura, setTipoReapertura] = useState<TipoOrden>("Reparación");
  const [enviandoReabrir, setEnviandoReabrir] = useState(false);

  const totales = calcularTotalesCotizacion(items);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/vehiculos/${vehiculo.id}/historial`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelado) return;
        const otras = (data.ordenes as HistorialEntrada[]).filter((h) => h.orden.id !== orden.id);
        setHistorial(otras);
      })
      .finally(() => {
        if (!cancelado) setCargandoHistorial(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vehiculo.id, orden.id]);

  function actualizarLinea(i: number, campo: keyof CotizacionItem, valor: string) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        if (campo === "descripcion" || campo === "tipo") {
          return { ...item, [campo]: valor };
        }
        return { ...item, [campo]: Number(valor) };
      })
    );
  }

  function quitarLinea(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function crearCotizacion(e: React.FormEvent) {
    e.preventDefault();
    if (!rol) return;
    setEnviandoCotizacion(true);
    setError(null);
    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId: orden.id, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la cotización.");
      setActividad(data.orden.actividad);
      onActualizada({ ...detalle, cotizacion: data.cotizacion, orden: data.orden });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cotización.");
    } finally {
      setEnviandoCotizacion(false);
    }
  }

  async function guardarItems() {
    if (!cotizacion || !rol) return;
    setEnviandoItems(true);
    setError(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron guardar los ítems.");
      setActividad(data.orden.actividad);
      onActualizada({ ...detalle, cotizacion: data.cotizacion, orden: data.orden });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los ítems.");
    } finally {
      setEnviandoItems(false);
    }
  }

  /** Low-level PATCH shared by every Cotización status/pago transition —
   *  returns the freshly saved cotización so callers can chain a second
   *  call (e.g. estado→"Aprobada" then pagada→true) off the real server
   *  state instead of a stale local value. */
  async function patchCotizacion(body: Record<string, unknown>): Promise<Cotizacion> {
    if (!cotizacion) throw new Error("Sin cotización.");
    const res = await fetch(`/api/cotizaciones/${cotizacion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar la cotización.");
    setActividad(data.orden.actividad);
    onActualizada({ ...detalle, cotizacion: data.cotizacion, orden: data.orden });
    return data.cotizacion as Cotizacion;
  }

  async function confirmarRechazo(seguimiento: boolean) {
    if (!cotizacion || !rol) return;
    setEnviandoDecision(true);
    setError(null);
    try {
      await patchCotizacion({ estado: "Rechazada", seguimiento });
      setMostrarRechazo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la cotización.");
    } finally {
      setEnviandoDecision(false);
    }
  }

  /**
   * A Cotización can move freely between any of its 4 real-world states —
   * Pendiente, Aprobada (unpaid), Pagada (the final Factura), Rechazada —
   * in either direction (e.g. undo an accidental "Pagada"), not just
   * forward through the original linear approve→pay flow. "Pagada" is the
   * only target needing two PATCH calls, since the server only allows
   * `pagada: true` once `estado` is already "Aprobada".
   */
  async function cambiarEstadoCombinado(valor: EstadoCombinado) {
    if (!cotizacion || !rol) return;

    if (valor === "Rechazada") {
      setMostrarRechazo(true);
      return;
    }

    setEnviandoDecision(true);
    setError(null);
    try {
      let actual = cotizacion;
      if (valor === "Pendiente") {
        if (actual.estado !== "Pendiente") actual = await patchCotizacion({ estado: "Pendiente" });
      } else if (valor === "Aprobada") {
        if (actual.estado !== "Aprobada") actual = await patchCotizacion({ estado: "Aprobada" });
        if (actual.pagada) actual = await patchCotizacion({ pagada: false });
      } else if (valor === "Pagada") {
        if (actual.estado !== "Aprobada") actual = await patchCotizacion({ estado: "Aprobada" });
        if (!actual.pagada) actual = await patchCotizacion({ pagada: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la cotización.");
    } finally {
      setEnviandoDecision(false);
    }
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !rol) return;
    e.target.value = "";

    setSubiendoFoto(true);
    setError(null);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/ordenes/${orden.id}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la foto.");
      setActividad(data.actividad);
      onActualizada({ ...detalle, orden: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function agregarNota() {
    if (!notaTexto.trim() || !rol) return;
    setEnviandoNota(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: notaTexto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo agregar la nota.");
      setNotas(data.notas);
      setNotaTexto("");
      onActualizada({ ...detalle, orden: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la nota.");
    } finally {
      setEnviandoNota(false);
    }
  }

  async function reabrir() {
    if (!rol) return;
    setEnviandoReabrir(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoOrden: tipoReapertura }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo reabrir la orden.");
      onOrdenCreada?.({ orden: data.orden, vehiculo: data.vehiculo, cliente: data.cliente, cotizacion: undefined });
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reabrir la orden.");
      setEnviandoReabrir(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-sm text-ink placeholder:text-ink/50 focus:border-safety focus:outline-none";

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-10">
      <div className="animate-rise-in w-full max-w-xl rounded-xl border border-ink/10 bg-paper p-4 shadow-lg sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-steel-light bg-steel px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-white">
                {vehiculo.placa}
              </span>
              {orden.tipoOrden === "Garantía" && (
                <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-semibold text-white">
                  Garantía
                </span>
              )}
            </div>
            <h2 className="mt-2 font-display text-2xl tracking-wide text-ink">
              {vehiculo.marca} {vehiculo.modelo} · {vehiculo.anio}
            </h2>
            <p className="text-sm text-ink/60">
              {cliente.nombre} · {cliente.telefono}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full px-2 py-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/60 sm:grid-cols-4">
          <span>Km: {orden.kilometraje ?? "—"}</span>
          <span>Combustible: {orden.combustible ?? "—"}</span>
          <span>Entrada: {orden.horaIngreso ?? "—"}</span>
          <span>Salida: {orden.horaSalida ?? "—"}</span>
        </div>

        {orden.diagnostico && (
          <p className="mt-4 rounded-md bg-bg px-4 py-3 text-sm text-ink/80">{orden.diagnostico}</p>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-stage-repuestos/30 bg-stage-repuestos/10 px-3 py-2 text-sm text-stage-repuestos">
            {error}
          </p>
        )}

        {/* --- Cotización / Orden / Factura --- */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="font-display text-lg tracking-wide text-ink/80">
            {cotizacion ? (esFactura ? "Factura" : "Orden") : "Cotización"}
          </h3>

          {cotizacion ? (
            (() => {
              const t = calcularTotalesCotizacion(cotizacion.items);
              // Line items stay editable at any Kanban stage until the
              // document becomes the final, paid Factura — matching
              // actualizarItemsCotizacion's own guard server-side. Mechanics
              // never see this form regardless (puedeFacturar already gates
              // that), same as the original creation form.
              const puedeEditarItems = puedeFacturar && !esFactura;
              const totalesEdicion = calcularTotalesCotizacion(items);

              return (
                <div className="mt-3">
                  {puedeEditarItems ? (
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-2 gap-2 border-b border-ink/10 pb-3 sm:grid-cols-[1fr_7rem_4rem_6rem_1.5rem] sm:items-center sm:border-0 sm:pb-0"
                        >
                          <input
                            required
                            placeholder="Descripción"
                            value={item.descripcion}
                            onChange={(e) => actualizarLinea(i, "descripcion", e.target.value)}
                            className={`${inputClass} col-span-2 sm:col-span-1`}
                          />
                          <select
                            value={item.tipo}
                            onChange={(e) => actualizarLinea(i, "tipo", e.target.value)}
                            className={inputClass}
                          >
                            <option value="Repuesto">Repuesto</option>
                            <option value="Mano de Obra">Mano de Obra</option>
                          </select>
                          <input
                            required
                            type="number"
                            min={1}
                            placeholder="Cant."
                            value={item.cantidad}
                            onChange={(e) => actualizarLinea(i, "cantidad", e.target.value)}
                            className={inputClass}
                          />
                          <input
                            required
                            type="number"
                            min={0}
                            placeholder="₡ neto/u"
                            value={item.precioUnitario || ""}
                            onChange={(e) => actualizarLinea(i, "precioUnitario", e.target.value)}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => quitarLinea(i)}
                            disabled={items.length === 1}
                            title="Quitar línea"
                            className="justify-self-end text-ink/30 hover:text-stage-repuestos disabled:opacity-0 sm:justify-self-auto"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setItems((prev) => [...prev, { ...LINEA_VACIA }])}
                        className="text-xs font-medium text-ink/50 hover:text-ink"
                      >
                        + Agregar línea
                      </button>

                      {puedeVerPrecios && (
                        <div className="space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/60">
                          <div className="flex justify-between">
                            <span>Total Neto</span>
                            <span className="font-mono">{formatColones(totalesEdicion.subtotalNeto)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>IVA (13%)</span>
                            <span className="font-mono">{formatColones(totalesEdicion.iva)}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        {puedeVerPrecios && (
                          <span className="text-sm font-medium">
                            Total: {formatColones(totalesEdicion.total)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={guardarItems}
                          disabled={enviandoItems}
                          className="ml-auto rounded-md bg-safety px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-safety-dark disabled:opacity-50"
                        >
                          {enviandoItems ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-1 text-sm text-ink/70">
                        {t.lineas.map((linea, i) => (
                          <li key={i} className="flex justify-between">
                            <span>
                              {linea.item.cantidad}× {linea.item.descripcion}{" "}
                              <span className="text-[10px] text-ink/40">({linea.item.tipo})</span>
                            </span>
                            {puedeVerPrecios && (
                              <span className="font-mono">{formatColones(linea.subtotalNeto)}</span>
                            )}
                          </li>
                        ))}
                      </ul>

                      {puedeVerPrecios && (
                        <>
                          <div className="mt-2 space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/60">
                            <div className="flex justify-between">
                              <span>Total mano de obra</span>
                              <span className="font-mono">{formatColones(t.totalManoDeObra)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total repuestos</span>
                              <span className="font-mono">{formatColones(t.totalRepuestos)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Neto</span>
                              <span className="font-mono">{formatColones(t.subtotalNeto)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total IVA (13%)</span>
                              <span className="font-mono">{formatColones(t.iva)}</span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between font-medium">
                            <span>Total</span>
                            <span className="font-mono">{formatColones(cotizacion.total)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-sm font-medium ${
                        cotizacion.estado === "Aprobada"
                          ? "text-stage-entregado"
                          : cotizacion.estado === "Rechazada"
                            ? "text-stage-repuestos"
                            : "text-amber"
                      }`}
                    >
                      {cotizacion.estado === "Pendiente" && "Pendiente de decisión"}
                      {cotizacion.estado === "Aprobada" && (esFactura ? "Aprobada y pagada" : "Aprobada, pendiente de pago")}
                      {cotizacion.estado === "Rechazada" && "Rechazada"}
                    </span>

                    {puedeFacturar && !mostrarRechazo && (
                      <select
                        value={estadoCombinadoDe(cotizacion)}
                        onChange={(e) => cambiarEstadoCombinado(e.target.value as EstadoCombinado)}
                        disabled={enviandoDecision}
                        className="rounded-md border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium text-ink focus:border-safety focus:outline-none disabled:opacity-50"
                      >
                        <option value="Pendiente">Pendiente de decisión</option>
                        <option value="Aprobada">Aprobada, pendiente de pago</option>
                        <option value="Pagada">Pagada (Factura)</option>
                        <option value="Rechazada">Rechazada</option>
                      </select>
                    )}
                  </div>

                  {mostrarRechazo && (
                    <div className="mt-3 rounded-md bg-bg p-3">
                      <label className="flex items-center gap-2 text-sm text-ink/70">
                        <input
                          type="checkbox"
                          checked={seguimientoChecked}
                          onChange={(e) => setSeguimientoChecked(e.target.checked)}
                        />
                        Programar seguimiento (recordatorio en 3 días)
                      </label>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMostrarRechazo(false)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarRechazo(seguimientoChecked)}
                          disabled={enviandoDecision}
                          className="rounded-md bg-stage-repuestos px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          Confirmar Rechazo
                        </button>
                      </div>
                    </div>
                  )}

                  {cotizacion.estado === "Rechazada" && cotizacion.seguimiento && (
                    <p className="mt-2 text-xs text-amber">
                      Seguimiento programado para {formatFecha(cotizacion.fechaSeguimiento!)}
                    </p>
                  )}

                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <DescargarCotizacionPdfButton
                      cotizacion={cotizacion}
                      orden={orden}
                      vehiculo={vehiculo}
                      cliente={cliente}
                    />
                  </div>
                </div>
              );
            })()
          ) : puedeFacturar ? (
            <form onSubmit={crearCotizacion} className="mt-3 space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-2 border-b border-ink/10 pb-3 sm:grid-cols-[1fr_7rem_4rem_6rem_1.5rem] sm:items-center sm:border-0 sm:pb-0"
                >
                  <input
                    required
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={(e) => actualizarLinea(i, "descripcion", e.target.value)}
                    className={`${inputClass} col-span-2 sm:col-span-1`}
                  />
                  <select
                    value={item.tipo}
                    onChange={(e) => actualizarLinea(i, "tipo", e.target.value)}
                    className={inputClass}
                  >
                    <option value="Repuesto">Repuesto</option>
                    <option value="Mano de Obra">Mano de Obra</option>
                  </select>
                  <input
                    required
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={item.cantidad}
                    onChange={(e) => actualizarLinea(i, "cantidad", e.target.value)}
                    className={inputClass}
                  />
                  <input
                    required
                    type="number"
                    min={0}
                    placeholder="₡ neto/u"
                    value={item.precioUnitario || ""}
                    onChange={(e) => actualizarLinea(i, "precioUnitario", e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => quitarLinea(i)}
                    disabled={items.length === 1}
                    title="Quitar línea"
                    className="justify-self-end text-ink/30 hover:text-stage-repuestos disabled:opacity-0 sm:justify-self-auto"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { ...LINEA_VACIA }])}
                className="text-xs font-medium text-ink/50 hover:text-ink"
              >
                + Agregar línea
              </button>

              <div className="space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/60">
                <div className="flex justify-between">
                  <span>Total Neto</span>
                  <span className="font-mono">{formatColones(totales.subtotalNeto)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (13%)</span>
                  <span className="font-mono">{formatColones(totales.iva)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium">Total: {formatColones(totales.total)}</span>
                <button
                  type="submit"
                  disabled={enviandoCotizacion}
                  className="rounded-md bg-safety px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-safety-dark disabled:opacity-50"
                >
                  {enviandoCotizacion ? "Guardando..." : "Crear Cotización"}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-sm text-ink/40">Sin cotización registrada.</p>
          )}
        </div>

        {/* --- Fotos --- */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="font-display text-lg tracking-wide text-ink/80">Fotos de Evidencia</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {orden.fotos.length === 0 && (
              <p className="text-sm text-ink/40">Sin fotos todavía.</p>
            )}
            {orden.fotos.map((foto, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={foto}
                alt={`Evidencia ${i + 1}`}
                className="h-20 w-20 rounded-md border border-ink/10 object-cover"
              />
            ))}
          </div>

          {puedeFotografiar && (
            <label className="mt-3 inline-block cursor-pointer rounded-md border border-dashed border-ink/20 px-4 py-2 text-xs font-medium text-ink/60 hover:border-safety hover:text-ink">
              {subiendoFoto ? "Subiendo..." : "+ Agregar Foto"}
              <input
                type="file"
                accept="image/*"
                onChange={subirFoto}
                disabled={subiendoFoto}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* --- Historial de Actividad: quién hizo qué, y cuándo (visible a todos los roles) --- */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="font-display text-lg tracking-wide text-ink/80">Historial de Actividad</h3>
          {actividad.length === 0 ? (
            <p className="mt-2 text-sm text-ink/40">Sin actividad registrada todavía.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {[...actividad].reverse().map((entrada, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
                  <span className="text-ink/70">{entrada.accion}</span>
                  <span className="font-mono text-ink/40">
                    {entrada.autor} · {formatFecha(entrada.fecha)} {entrada.hora}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- Notas (visible a todos los roles) --- */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="font-display text-lg tracking-wide text-ink/80">Notas</h3>
          <ul className="mt-3 space-y-2">
            {notas.length === 0 && <p className="text-sm text-ink/40">Sin notas todavía.</p>}
            {notas.map((nota, i) => (
              <li key={i} className="rounded-md bg-bg px-3 py-2 text-sm">
                <p className="text-ink/80">{nota.texto}</p>
                <p className="mt-0.5 font-mono text-[10px] text-ink/40">
                  {nota.autor} · {formatFecha(nota.fecha)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              placeholder="Agregar una nota..."
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarNota();
                }
              }}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={agregarNota}
              disabled={enviandoNota || !notaTexto.trim()}
              className="rounded-md bg-steel px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-safety disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>

        {/* --- Historial del vehículo (visible a todos los roles) --- */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="font-display text-lg tracking-wide text-ink/80">Historial del Vehículo</h3>
          {cargandoHistorial ? (
            <p className="mt-2 text-sm text-ink/40">Cargando...</p>
          ) : !historial || historial.length === 0 ? (
            <p className="mt-2 text-sm text-ink/40">Sin visitas anteriores.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {historial.map(({ orden: o, cotizacion: c }) => (
                <li key={o.id} className="rounded-md border border-ink/10 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="text-ink/80">{o.diagnostico || "Sin diagnóstico registrado"}</span>
                    <span className="font-mono text-xs text-ink/40">{formatFecha(o.fechaIngreso)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {o.estadoKanban} · {o.tipoOrden}
                    {puedeVerPrecios && c && ` · ${formatColones(c.total)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- Reabrir orden (solo si ya fue entregada) --- */}
        {puedeFacturar && orden.estadoKanban === "Entregado" && (
          <div className="mt-6 border-t border-ink/10 pt-5">
            {!mostrarReabrir ? (
              <button
                type="button"
                onClick={() => setMostrarReabrir(true)}
                className="text-sm font-medium text-ink/60 underline-offset-2 hover:text-safety hover:underline"
              >
                Reabrir Orden
              </button>
            ) : (
              <div className="rounded-md bg-bg p-3">
                <p className="text-sm text-ink/70">
                  Se creará una nueva orden para este vehículo. Clasifíquela:
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={tipoReapertura}
                    onChange={(e) => setTipoReapertura(e.target.value as TipoOrden)}
                    className={inputClass}
                  >
                    <option value="Reparación">Reparación</option>
                    <option value="Garantía">Garantía</option>
                  </select>
                  <button
                    type="button"
                    onClick={reabrir}
                    disabled={enviandoReabrir}
                    className="rounded-md bg-safety px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-safety-dark disabled:opacity-50"
                  >
                    {enviandoReabrir ? "Creando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 font-mono text-[11px] text-ink/30">
          Ingreso: {formatFecha(orden.fechaIngreso)}
          {orden.fechaEntrega && ` · Entrega: ${formatFecha(orden.fechaEntrega)}`}
        </p>
      </div>
    </div>
  );
}
