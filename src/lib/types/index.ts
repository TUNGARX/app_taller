// Shared domain types mirroring the 5 Google Sheets tables defined in PROJECT_CONTEXT.MD.
// These interfaces are the single source of truth for the mock DB layer and, later,
// for the real Google Sheets API integration — keep both in sync with this file.

/** Internal staff roles. Clients are unauthenticated and are not part of this union. */
export type Rol = "Owner" | "Secretary" | "Mechanic";

/**
 * The 8 stages of the Kanban workflow, in left-to-right order — the shop's
 * real intake-to-delivery flow (per client questionnaire), not a guessed one.
 */
export type EstadoKanban =
  | "Ingresado"
  | "En Revisión"
  | "En Cotización"
  | "Esperando Repuestos"
  | "En Reparación"
  | "Terminado"
  | "En Pruebas"
  | "Entregado";

export const ORDEN_ESTADOS: EstadoKanban[] = [
  "Ingresado",
  "En Revisión",
  "En Cotización",
  "Esperando Repuestos",
  "En Reparación",
  "Terminado",
  "En Pruebas",
  "Entregado",
];

export type EstadoCita = "Programada" | "Confirmada" | "Cancelada" | "Completada";

// --- Clientes -----------------------------------------------------------

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string; // Costa Rica format, e.g. "8888-1234"
  email: string;
  direccion: string;
}

// --- Vehiculos ------------------------------------------------------------

export interface Vehiculo {
  id: string;
  clienteId: string;
  placa: string; // Costa Rica plate format, e.g. "BPP123"
  marca: string;
  modelo: string;
  anio: number;
  color: string;
}

// --- Citas ----------------------------------------------------------------

export interface Cita {
  id: string;
  clienteId: string;
  vehiculoId: string;
  fecha: string; // ISO date, e.g. "2026-08-03"
  hora: string; // "HH:mm"
  motivo: string;
  estado: EstadoCita;
  /** Google Calendar event id on the taller's own calendar, once synced. Null
   *  if Google Calendar isn't configured or the sync call failed. */
  eventoGoogleId: string | null;
}

// --- Ordenes_Trabajo --------------------------------------------------------

/** Whether a job is a normal paid repair or a warranty redo of a prior job. */
export type TipoOrden = "Reparación" | "Garantía";

export type NivelCombustible = "Vacío" | "1/4" | "1/2" | "3/4" | "Lleno";
export const NIVELES_COMBUSTIBLE: NivelCombustible[] = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];

export interface NotaOrden {
  autor: string;
  rol: Rol;
  texto: string;
  fecha: string; // ISO date
}

/**
 * One entry in a card's audit trail — who did what, and when. Logged
 * automatically by every mutating action (status move, quote decision,
 * payment, photo upload, reopen), as opposed to NotaOrden which is a manual
 * comment a worker chooses to leave. This is how more than one person
 * sharing a role (e.g. two mechanics) stays distinguishable on a shared card.
 */
export interface ActividadOrden {
  autor: string;
  rol: Rol;
  accion: string;
  fecha: string; // ISO date
  hora: string; // "HH:mm"
}

export type TipoMedia = "foto" | "video";

/**
 * One evidence photo/video stored in Google Drive (see src/lib/google/drive.ts).
 * Only the Drive file id + resolved links are kept in SQLite — the actual
 * bytes live in Drive, under a folder named after the vehicle's plate, so
 * this record is really just a pointer, not the media itself.
 */
export interface MediaOrden {
  id: number;
  tipo: TipoMedia;
  driveFileId: string;
  url: string; // Drive webViewLink
  thumbnailUrl: string | null;
  mimeType: string;
  nombre: string;
  fecha: string; // ISO date
}

export interface OrdenTrabajo {
  id: string;
  citaId: string | null;
  vehiculoId: string;
  estadoKanban: EstadoKanban;
  tipoOrden: TipoOrden;
  /** Set when this order was opened by reopening a previously delivered one. */
  ordenOrigenId: string | null;
  diagnostico: string;
  kilometraje: number | null;
  combustible: NivelCombustible | null;
  horaIngreso: string | null; // "HH:mm"
  horaSalida: string | null; // "HH:mm"
  notas: NotaOrden[];
  actividad: ActividadOrden[];
  fotos: string[]; // legacy evidence photos stored as data: URLs, pre-Drive-integration
  media: MediaOrden[]; // photos + videos stored in Google Drive
  fechaIngreso: string; // ISO date
  fechaEntrega: string | null; // ISO date, null until delivered
}

// --- Cotizaciones -----------------------------------------------------------

export const IVA_TASA = 0.13; // Costa Rica standard VAT rate

export type CotizacionItemTipo = "Repuesto" | "Mano de Obra";

export interface CotizacionItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number; // colones (CRC), precio neto — antes de IVA
  tipo: CotizacionItemTipo;
}

/** Client's decision on a quote. "Pendiente" is the only state that can still change. */
export type EstadoCotizacion = "Pendiente" | "Aprobada" | "Rechazada";

export interface Cotizacion {
  id: string;
  ordenId: string;
  items: CotizacionItem[];
  total: number; // colones (CRC), total final — incluye 13% de IVA
  estado: EstadoCotizacion;
  pagada: boolean; // only meaningful once estado === "Aprobada"
  /** Follow-up flag for a rejected quote — set alongside estado "Rechazada". */
  seguimiento: boolean;
  fechaSeguimiento: string | null; // ISO date; rejection date + 3 days when seguimiento is true
  fecha: string; // ISO date
}

// --- View types --------------------------------------------------------------
// Derived shapes joining multiple tables, used to pass pre-resolved data from
// server components to client components without extra client-side fetches.

export interface OrdenConDetalle {
  orden: OrdenTrabajo;
  vehiculo: Vehiculo;
  cliente: Cliente;
  cotizacion: Cotizacion | undefined;
}
