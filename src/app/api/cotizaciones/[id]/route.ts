import { NextResponse } from "next/server";
import { getOrdenById, setCotizacionEstado, setCotizacionPagada } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";
import type { EstadoCotizacion } from "@/lib/types";

// PATCH { estado, seguimiento? } to record the client's decision on a quote
// (seguimiento schedules a 3-day follow-up reminder when rejecting), or
// PATCH { pagada } to mark an approved quote as paid — the point at which
// the document becomes a "Factura" instead of an "Orden". Returns
// { cotizacion, orden } since both decision helpers log activity onto the
// order's audit trail, attributed to the verified signed-in session.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: { estado?: EstadoCotizacion; seguimiento?: boolean; pagada?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  try {
    if (typeof body.pagada === "boolean") {
      const cotizacion = setCotizacionPagada(id, body.pagada, check.actor);
      return NextResponse.json({ cotizacion, orden: getOrdenById(cotizacion.ordenId) });
    }

    if (body.estado === "Pendiente" || body.estado === "Aprobada" || body.estado === "Rechazada") {
      const cotizacion = setCotizacionEstado(id, body.estado, check.actor, body.seguimiento ?? false);
      return NextResponse.json({ cotizacion, orden: getOrdenById(cotizacion.ordenId) });
    }

    return NextResponse.json(
      { error: "Debe indicar 'estado' o 'pagada'." },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar la cotización.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
