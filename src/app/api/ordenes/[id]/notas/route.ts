import { NextResponse } from "next/server";
import { agregarNotaOrden } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";

// POST { texto } to append a note to a work order's shared comment thread —
// visible to every role (mechanics included). The author is derived from
// the verified session, not the request body.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: { texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.texto) {
    return NextResponse.json({ error: "texto es obligatorio." }, { status: 400 });
  }

  try {
    const orden = agregarNotaOrden(id, check.actor.autor, check.actor.rol, body.texto);
    return NextResponse.json(orden);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al agregar la nota.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
