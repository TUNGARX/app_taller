import { NextResponse } from "next/server";
import { listarCotizaciones, crearCotizacion, getOrdenById } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { auth } from "@/auth";
import type { CotizacionItem } from "@/lib/types";

// Mechanics never see quote prices — same rule enforced in the dashboard's
// initial payload — so this returns an empty list for that role rather than
// the raw totals.
export async function GET() {
  const session = await auth();
  if (session?.user?.rol === "Mechanic") {
    return NextResponse.json([]);
  }
  return NextResponse.json(listarCotizaciones());
}

export async function POST(request: Request) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  let body: { ordenId?: string; items?: CotizacionItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.ordenId || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "ordenId e items son obligatorios." },
      { status: 400 }
    );
  }

  try {
    const cotizacion = crearCotizacion(body.ordenId, body.items, check.actor);
    const orden = getOrdenById(body.ordenId);
    return NextResponse.json({ cotizacion, orden }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear la cotización.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
