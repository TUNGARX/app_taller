import { NextResponse } from "next/server";
import { listarCitas, crearCita, type CrearCitaInput } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";

export async function GET() {
  return NextResponse.json(listarCitas());
}

// Same role restriction as PATCH /api/citas/[id]: only Owner/Secretary
// manage appointments.
export async function POST(request: Request) {
  const check = await requireActor();
  if ("error" in check) return check.error;
  if (check.actor.rol === "Mechanic") {
    return NextResponse.json(
      { error: "Solo el dueño o la secretaria pueden administrar citas." },
      { status: 403 }
    );
  }

  let body: CrearCitaInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.fecha || !body.hora || !body.motivo) {
    return NextResponse.json(
      { error: "Fecha, hora y motivo son obligatorios." },
      { status: 400 }
    );
  }

  try {
    const resultado = crearCita(body);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear la cita.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
