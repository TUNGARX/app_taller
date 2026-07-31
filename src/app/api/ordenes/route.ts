import { NextResponse } from "next/server";
import { crearOrden, getOrdenesByEstado, listarOrdenes, type CrearOrdenInput } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { ORDEN_ESTADOS, type EstadoKanban } from "@/lib/types";

// Supports ?estado= for Kanban column filtering.
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

  return NextResponse.json(listarOrdenes());
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
