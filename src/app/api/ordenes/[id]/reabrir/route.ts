import { NextResponse } from "next/server";
import { getClienteById, getVehiculoById, reabrirOrden } from "@/lib/mock-db";
import { requireActor } from "@/lib/auth/getActorFromSession";
import type { TipoOrden } from "@/lib/types";

// POST { tipoOrden } to reopen a delivered order as a brand-new order for
// the same vehicle (e.g. the customer returns because the issue wasn't
// fixed), classified as "Reparación" (paid redo) or "Garantía" (warranty redo).
// The acting user is derived from the verified session, not the request body.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: { tipoOrden?: TipoOrden };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (body.tipoOrden !== "Reparación" && body.tipoOrden !== "Garantía") {
    return NextResponse.json(
      { error: "tipoOrden debe ser 'Reparación' o 'Garantía'." },
      { status: 400 }
    );
  }

  try {
    const orden = reabrirOrden(id, body.tipoOrden, check.actor);
    const vehiculo = getVehiculoById(orden.vehiculoId)!;
    const cliente = getClienteById(vehiculo.clienteId)!;
    return NextResponse.json({ orden, vehiculo, cliente }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al reabrir la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
