import { NextResponse } from "next/server";
import { agregarFotoOrden } from "@/lib/mock-db";
import { requireActor } from "@/lib/auth/getActorFromSession";

// POST { url } to append an evidence photo to a work order. `url` is a
// data: URL from the browser for now (no real storage backend yet) — this
// will point at a Google Drive public preview link once that integration
// exists. The acting user is derived from the verified session.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  const { id } = await params;
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "url es obligatorio." }, { status: 400 });
  }

  try {
    const orden = agregarFotoOrden(id, body.url, check.actor);
    return NextResponse.json(orden);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al agregar la foto.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
