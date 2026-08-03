import { getCalendarClient } from "./client";
import type { Cita, Cliente, Vehiculo } from "@/lib/types";

// Every Cita created in the app gets mirrored onto the taller's own Google
// Calendar (the impersonated account, contacto@fonsfideishop.com) — per the
// client's explicit requirement that appointment alerts go through Google
// Calendar, not WhatsApp. WhatsApp is reserved for Kanban status alerts
// (see CLAUDE.md).
const ZONA_HORARIA = "America/Costa_Rica";
const DURACION_MINUTOS = 60;

function toDateTime(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00`;
}

function addMinutes(fecha: string, hora: string, minutos: number): string {
  const inicio = new Date(`${fecha}T${hora}:00`);
  inicio.setMinutes(inicio.getMinutes() + minutos);
  return inicio.toISOString().slice(0, 19);
}

/** Creates the Calendar event for a newly scheduled Cita and returns its
 *  Google event id, to be stored on the Cita row (setCitaEventoGoogle) so it
 *  can be cancelled/updated later. */
export async function crearEventoCita(cita: Cita, cliente: Cliente, vehiculo: Vehiculo): Promise<string> {
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${vehiculo.placa} — ${cliente.nombre}`,
      description: `${cita.motivo}\n\nCliente: ${cliente.nombre} (${cliente.telefono})\nVehículo: ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}, placa ${vehiculo.placa}`,
      start: { dateTime: toDateTime(cita.fecha, cita.hora), timeZone: ZONA_HORARIA },
      end: { dateTime: addMinutes(cita.fecha, cita.hora, DURACION_MINUTOS), timeZone: ZONA_HORARIA },
    },
  });

  if (!res.data.id) throw new Error("No se pudo crear el evento en Google Calendar.");
  return res.data.id;
}

/** Removes a Cita's event — called when the Cita is cancelled. */
export async function eliminarEventoCita(eventoGoogleId: string): Promise<void> {
  const calendar = getCalendarClient();
  try {
    await calendar.events.delete({ calendarId: "primary", eventId: eventoGoogleId });
  } catch (error) {
    // Already deleted directly in Google Calendar by the shop — not a failure
    // of the app's own cancel flow, so don't block it on this.
    const status = (error as { code?: number })?.code;
    if (status !== 404 && status !== 410) throw error;
  }
}
