import { NextResponse } from "next/server";
import {
  actualizarItemsCotizacion,
  getOrdenById,
  setCotizacionEstado,
  setCotizacionPagada,
} from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";
import type { CotizacionItem, EstadoCotizacion } from "@/lib/types";

// PATCH { estado, seguimiento? } to record the client's decision on a quote
// (seguimiento schedules a 3-day follow-up reminder when rejecting), or
// PATCH { pagada } to mark an approved quote as paid — the point at which
// the document becomes a "Factura" instead of an "Orden" — or PATCH { items }
// to add/remove/edit line items (allowed at any Kanban stage, blocked once
// the quote is a paid Factura — see actualizarItemsCotizacion). Returns
// { cotizacion, orden } since every one of these logs activity onto the
// order's audit trail, attributed to the verified signed-in session.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: {
    estado?: EstadoCotizacion;
    seguimiento?: boolean;
    pagada?: boolean;
    items?: CotizacionItem[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  try {
    if (Array.isArray(body.items)) {
      const cotizacion = actualizarItemsCotizacion(id, body.items, check.actor);
      return NextResponse.json({ cotizacion, orden: getOrdenById(cotizacion.ordenId) });
    }

    if (typeof body.pagada === "boolean") {
      const cotizacion = setCotizacionPagada(id, body.pagada, check.actor);
      return NextResponse.json({ cotizacion, orden: getOrdenById(cotizacion.ordenId) });
    }

    if (body.estado === "Pendiente" || body.estado === "Aprobada" || body.estado === "Rechazada") {
      const cotizacion = setCotizacionEstado(id, body.estado, check.actor, body.seguimiento ?? false);
      return NextResponse.json({ cotizacion, orden: getOrdenById(cotizacion.ordenId) });
    }

    return NextResponse.json(
      { error: "Debe indicar 'estado', 'pagada' o 'items'." },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar la cotización.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
