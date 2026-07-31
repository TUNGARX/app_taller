import { NextResponse } from "next/server";
import { crearOrden, getOrdenesByEstado, ordenesTrabajo, type CrearOrdenInput } from "@/lib/mock-db";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { ORDEN_ESTADOS, type EstadoKanban } from "@/lib/types";

// Stub route handler backed by the mock DB. Supports ?estado= for Kanban column
// filtering. Will point at the real "Ordenes_Trabajo" Google Sheet later.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as EstadoKanban | null;

  if (estado) {
    if (!ORDEN_ESTADOS.includes(estado)) {
      return NextResponse.json(
        { error: "Estado de orden inválido." },
        { status: 400 }
      );
    }
    return NextResponse.json(getOrdenesByEstado(estado));
  }

  return NextResponse.json(ordenesTrabajo);
}

export async function POST(request: Request) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  let body: CrearOrdenInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  try {
    const resultado = crearOrden(body, check.actor);
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
