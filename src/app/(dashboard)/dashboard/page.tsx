import {
  citas,
  cotizaciones,
  getClienteById,
  getCotizacionByOrdenId,
  getSeguimientosPendientes,
  getVehiculoById,
  ordenesTrabajo,
  vehiculos,
} from "@/lib/mock-db";
import type { OrdenConDetalle } from "@/lib/types";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import StatTile from "@/components/StatTile";
import { formatColones } from "@/lib/format";
import { auth } from "@/auth";
import { ocultarCotizacionSiMecanico } from "@/lib/cotizacion-redaccion";

export default async function DashboardPage() {
  const session = await auth();
  const rol = session?.user?.rol ?? null;
  const esMecanico = rol === "Mechanic";

  const ordenesDetalle: OrdenConDetalle[] = ordenesTrabajo.map((orden) => {
    const vehiculo = getVehiculoById(orden.vehiculoId)!;
    const detalle: OrdenConDetalle = {
      orden,
      vehiculo,
      cliente: getClienteById(vehiculo.clienteId)!,
      cotizacion: getCotizacionByOrdenId(orden.id),
    };
    return ocultarCotizacionSiMecanico(detalle, rol);
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const citasHoy = citas.filter((c) => c.fecha === hoy && c.estado !== "Cancelada").length;
  const activas = ordenesTrabajo.filter((o) => o.estadoKanban !== "Entregado").length;
  const porAprobar = cotizaciones.filter((c) => c.estado === "Pendiente").length;
  const ingresosMes = cotizaciones
    .filter((c) => c.estado === "Aprobada" && c.pagada)
    .reduce((sum, c) => sum + c.total, 0);
  const seguimientos = getSeguimientosPendientes();

  const vehiculosConCliente = vehiculos.map((vehiculo) => ({
    vehiculo,
    clienteNombre: getClienteById(vehiculo.clienteId)?.nombre ?? "Desconocido",
  }));

  return (
    <div className="flex-1 bg-bg px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-4xl tracking-wide text-ink">Panel de Trabajo</h1>
        <p className="mt-1 text-sm text-ink/60">
          Arrastra el estado con los botones de cada tarjeta para avanzar el flujo del taller.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Órdenes Activas" value={String(activas)} accent="safety" />
          <StatTile label="Citas Hoy" value={String(citasHoy)} accent="amber" />
          {!esMecanico && <StatTile label="Cotiz. por Decidir" value={String(porAprobar)} />}
          {!esMecanico && (
            <StatTile label="Facturado" value={formatColones(ingresosMes)} accent="safety" />
          )}
          <StatTile label="Seguimientos" value={String(seguimientos.length)} accent="amber" />
        </div>

        {seguimientos.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3">
            <p className="text-sm font-medium text-ink/80">
              Cotizaciones rechazadas con seguimiento pendiente:
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-ink/60">
              {seguimientos.map(({ cotizacion, vehiculo, cliente }) => (
                <li key={cotizacion.id}>
                  {vehiculo?.placa ?? "—"} · {cliente?.nombre ?? "Cliente"} — desde{" "}
                  {cotizacion.fechaSeguimiento}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <KanbanBoard ordenesIniciales={ordenesDetalle} vehiculosConCliente={vehiculosConCliente} />
        </div>
      </div>
    </div>
  );
}
