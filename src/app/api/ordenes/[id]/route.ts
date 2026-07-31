import { NextResponse } from "next/server";
import { moverOrdenEstado } from "@/lib/mock-db";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { ORDEN_ESTADOS, type EstadoKanban } from "@/lib/types";

// PATCH { estadoKanban } to move a work order between Kanban columns. The
// acting user is derived from the verified session, not the request body —
// this is the Kanban move endpoint, so every card update is attributed to a
// real signed-in account.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: { estadoKanban?: EstadoKanban };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.estadoKanban || !ORDEN_ESTADOS.includes(body.estadoKanban)) {
    return NextResponse.json({ error: "Estado de orden inválido." }, { status: 400 });
  }

  try {
    const orden = moverOrdenEstado(id, body.estadoKanban, check.actor);
    return NextResponse.json(orden);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar la orden.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
