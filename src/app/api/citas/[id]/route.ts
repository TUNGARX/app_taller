import { NextResponse } from "next/server";
import { setCitaEstado } from "@/lib/mock-db";
import { requireActor } from "@/lib/auth/getActorFromSession";
import type { EstadoCita } from "@/lib/types";

const ESTADOS_VALIDOS: EstadoCita[] = ["Programada", "Confirmada", "Cancelada", "Completada"];

// PATCH { estado } to advance or cancel a Cita. Requires a signed-in
// staff session (Owner/Secretary) — enforced the same way as every other
// mutating route, via the verified session rather than a client-supplied body.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;
  if (check.actor.rol === "Mechanic") {
    return NextResponse.json(
      { error: "Solo el dueño o la secretaria pueden administrar citas." },
      { status: 403 }
    );
  }

  const { id } = await params;
  let body: { estado?: EstadoCita };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.estado || !ESTADOS_VALIDOS.includes(body.estado)) {
    return NextResponse.json({ error: "Estado de cita inválido." }, { status: 400 });
  }

  try {
    const cita = setCitaEstado(id, body.estado);
    return NextResponse.json(cita);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar la cita.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
