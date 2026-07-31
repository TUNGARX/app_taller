import { NextResponse } from "next/server";
import { citas, crearCita, type CrearCitaInput } from "@/lib/mock-db";

// Stub route handler backed by the mock DB. Will point at the real
// "Citas" Google Sheet once the Sheets API integration is built.
export async function GET() {
  return NextResponse.json(citas);
}

export async function POST(request: Request) {
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
