import { NextResponse } from "next/server";
import { listarCitas, crearCita, setCitaEventoGoogle, type CrearCitaInput } from "@/lib/db/negocio";
import { googleConfigurado } from "@/lib/google/client";
import { crearEventoCita } from "@/lib/google/calendar";

export async function GET() {
  return NextResponse.json(listarCitas());
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

    // Best-effort Google Calendar sync — a Cita is still valid without it
    // (e.g. Google isn't configured yet on this server), so a sync failure
    // here never blocks scheduling the appointment.
    if (googleConfigurado()) {
      try {
        const eventoGoogleId = await crearEventoCita(resultado.cita, resultado.cliente, resultado.vehiculo);
        setCitaEventoGoogle(resultado.cita.id, eventoGoogleId);
        resultado.cita.eventoGoogleId = eventoGoogleId;
      } catch (syncError) {
        console.error("No se pudo sincronizar la cita con Google Calendar:", syncError);
      }
    }

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear la cita.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
