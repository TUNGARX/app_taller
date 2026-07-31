import { clientes as clientesIniciales } from "./clientes";
import { vehiculos as vehiculosIniciales } from "./vehiculos";
import { citas as citasIniciales } from "./citas";
import { ordenesTrabajo as ordenesTrabajoIniciales } from "./ordenes-trabajo";
import { cotizaciones as cotizacionesIniciales } from "./cotizaciones";
import type {
  ActividadOrden,
  Cita,
  Cliente,
  Cotizacion,
  CotizacionItem,
  EstadoCita,
  EstadoCotizacion,
  EstadoKanban,
  NivelCombustible,
  NotaOrden,
  OrdenTrabajo,
  Rol,
  TipoOrden,
  Vehiculo,
} from "@/lib/types";
import { ORDEN_ESTADOS } from "@/lib/types";
import { calcularTotalesCotizacion } from "@/lib/cotizacion-calc";

// Next.js dev (Turbopack) can instantiate this module more than once across
// Route Handlers vs. Server Components, which would otherwise give each side
// its own copy of these arrays and silently drop writes. Stashing the mutable
// store on `globalThis` guarantees a single shared instance per server process,
// the same pattern used for singleton DB clients in Next.js apps.
declare global {
  var __tallerMockDb:
    | {
        clientes: Cliente[];
        vehiculos: Vehiculo[];
        citas: Cita[];
        ordenesTrabajo: OrdenTrabajo[];
        cotizaciones: Cotizacion[];
      }
    | undefined;
}

const store =
  globalThis.__tallerMockDb ??
  (globalThis.__tallerMockDb = {
    clientes: [...clientesIniciales],
    vehiculos: [...vehiculosIniciales],
    citas: [...citasIniciales],
    ordenesTrabajo: [...ordenesTrabajoIniciales],
    cotizaciones: [...cotizacionesIniciales],
  });

export const clientes = store.clientes;
export const vehiculos = store.vehiculos;
export const citas = store.citas;
export const ordenesTrabajo = store.ordenesTrabajo;
export const cotizaciones = store.cotizaciones;

// --- Accessor functions -----------------------------------------------------
// These simulate what will later be async calls to the Google Sheets API.
// Keeping this as the only access path means swapping the implementation later
// won't require touching any component that consumes this data.

export function getClienteById(id: string): Cliente | undefined {
  return clientes.find((c) => c.id === id);
}

export function getVehiculoById(id: string): Vehiculo | undefined {
  return vehiculos.find((v) => v.id === id);
}

function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function getVehiculoByPlaca(placa: string): Vehiculo | undefined {
  const normalized = normalizePlaca(placa);
  return vehiculos.find((v) => v.placa.replace(/[\s-]/g, "") === normalized);
}

export function getVehiculosByClienteId(clienteId: string): Vehiculo[] {
  return vehiculos.filter((v) => v.clienteId === clienteId);
}

export function getCitasByVehiculoId(vehiculoId: string): Cita[] {
  return citas.filter((c) => c.vehiculoId === vehiculoId);
}

export function getOrdenesByVehiculoId(vehiculoId: string): OrdenTrabajo[] {
  return ordenesTrabajo.filter((o) => o.vehiculoId === vehiculoId);
}

export function getOrdenesByEstado(estado: EstadoKanban): OrdenTrabajo[] {
  return ordenesTrabajo.filter((o) => o.estadoKanban === estado);
}

export function getOrdenById(id: string): OrdenTrabajo | undefined {
  return ordenesTrabajo.find((o) => o.id === id);
}

export function getCotizacionByOrdenId(ordenId: string): Cotizacion | undefined {
  return cotizaciones.find((c) => c.ordenId === ordenId);
}

/** Full vehicle history: appointments + work orders + quotations, newest first.
 *  Keyed by vehiculoId (i.e. by plate), independent of who currently owns it —
 *  ownership transfers reuse the same vehiculoId, so history always follows
 *  the plate rather than the client. */
export function getHistorialVehiculo(vehiculoId: string) {
  const vehiculo = getVehiculoById(vehiculoId);
  const ordenes = getOrdenesByVehiculoId(vehiculoId)
    .map((orden) => ({
      orden,
      cotizacion: getCotizacionByOrdenId(orden.id),
    }))
    .sort((a, b) => (a.orden.fechaIngreso < b.orden.fechaIngreso ? 1 : -1));

  return { vehiculo, ordenes };
}

/** Advances or cancels a Cita — e.g. Confirmada once the client confirms,
 *  Completada once they show up, or Cancelada at any point. */
export function setCitaEstado(citaId: string, estado: EstadoCita): Cita {
  const cita = citas.find((c) => c.id === citaId);
  if (!cita) throw new Error("Cita no encontrada.");
  cita.estado = estado;
  return cita;
}

/** All citas, newest first, with the cliente/vehiculo already resolved for display. */
export function getCitasConDetalle() {
  return [...citas]
    .sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1))
    .map((cita) => ({
      cita,
      cliente: getClienteById(cita.clienteId),
      vehiculo: getVehiculoById(cita.vehiculoId),
    }));
}

/** Rejected quotes flagged for follow-up whose reminder date has arrived. */
export function getSeguimientosPendientes() {
  const hoy = new Date().toISOString().slice(0, 10);
  return cotizaciones
    .filter((c) => c.estado === "Rechazada" && c.seguimiento && (c.fechaSeguimiento ?? "") <= hoy)
    .map((cotizacion) => {
      const orden = getOrdenById(cotizacion.ordenId);
      const vehiculo = orden ? getVehiculoById(orden.vehiculoId) : undefined;
      const cliente = vehiculo ? getClienteById(vehiculo.clienteId) : undefined;
      return { cotizacion, orden, vehiculo, cliente };
    });
}

// --- Mutations ---------------------------------------------------------------
// In-memory writes only (reset on server restart). This is the boundary that
// will later be replaced with real writes to the Google Sheets API.

function nextId(prefix: string, existing: { id: string }[]): string {
  const n = existing.length + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** Who performed a mutating action — every card action gets attributed to
 *  one of these so more than one person sharing a role stays distinguishable. */
export interface Actor {
  autor: string;
  rol: Rol;
}

/** Appends an audit-trail entry to a work order. Called internally by every
 *  action that changes an order or its Cotización — this is the shop's
 *  "who did what, and when" card history. */
function agregarActividad(orden: OrdenTrabajo, actor: Actor, accion: string): void {
  const ahora = new Date();
  const entrada: ActividadOrden = {
    autor: actor.autor,
    rol: actor.rol,
    accion,
    fecha: ahora.toISOString().slice(0, 10),
    hora: ahora.toTimeString().slice(0, 5),
  };
  orden.actividad.push(entrada);
}

export function addCliente(data: Omit<Cliente, "id">): Cliente {
  const cliente: Cliente = { id: nextId("cli", clientes), ...data };
  clientes.push(cliente);
  return cliente;
}

export function addVehiculo(data: Omit<Vehiculo, "id">): Vehiculo {
  const vehiculo: Vehiculo = { id: nextId("veh", vehiculos), ...data };
  vehiculos.push(vehiculo);
  return vehiculo;
}

export function addCita(data: Omit<Cita, "id">): Cita {
  const cita: Cita = { id: nextId("cit", citas), ...data };
  citas.push(cita);
  return cita;
}

export interface NuevoClienteInput {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
}

export interface NuevoVehiculoInput {
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
}

export interface ClienteVehiculoInput {
  // Existing client/vehicle path:
  clienteId?: string;
  vehiculoId?: string;
  // New registration path (used when the vehicle has never visited before,
  // or when it has changed hands — see resolverClienteVehiculo below):
  clienteNuevo?: NuevoClienteInput;
  vehiculoNuevo?: NuevoVehiculoInput;
}

/**
 * Resolves a client + vehicle pair from either existing IDs or inline
 * registration data. Shared by crearCita and crearOrden so both flows can
 * register a brand-new client/vehicle in the same step.
 *
 * Ownership transfer: if `vehiculoNuevo.placa` matches a plate that's already
 * registered, the vehicle has changed hands — the existing `vehiculo` record
 * is re-pointed at the new/given client rather than rejected or duplicated,
 * so its full service history (keyed by vehiculoId) stays intact under the
 * new owner. Only a genuinely new plate creates a new vehiculo record.
 */
function resolverClienteVehiculo(input: ClienteVehiculoInput): {
  cliente: Cliente;
  vehiculo: Vehiculo;
} {
  let cliente: Cliente | undefined;

  if (input.clienteId) {
    cliente = getClienteById(input.clienteId);
    if (!cliente) throw new Error("Cliente no encontrado.");
  } else if (input.clienteNuevo) {
    cliente = addCliente(input.clienteNuevo);
  } else {
    throw new Error("Debe indicar un cliente existente o los datos de un cliente nuevo.");
  }

  let vehiculo: Vehiculo | undefined;

  if (input.vehiculoId) {
    vehiculo = getVehiculoById(input.vehiculoId);
    if (!vehiculo) throw new Error("Vehículo no encontrado.");
  } else if (input.vehiculoNuevo) {
    const existente = getVehiculoByPlaca(input.vehiculoNuevo.placa);
    if (existente) {
      // Plate already on file under a different (or the same) client —
      // treat this as an ownership transfer instead of an error.
      existente.clienteId = cliente.id;
      existente.marca = input.vehiculoNuevo.marca;
      existente.modelo = input.vehiculoNuevo.modelo;
      existente.anio = input.vehiculoNuevo.anio;
      existente.color = input.vehiculoNuevo.color;
      vehiculo = existente;
    } else {
      vehiculo = addVehiculo({ ...input.vehiculoNuevo, clienteId: cliente.id });
    }
  } else {
    throw new Error("Debe indicar un vehículo existente o los datos de un vehículo nuevo.");
  }

  return { cliente, vehiculo };
}

export interface CrearCitaInput extends ClienteVehiculoInput {
  fecha: string;
  hora: string;
  motivo: string;
}

/**
 * Schedules a Cita. Supports registering a brand-new client + vehicle inline
 * (the "appointment scheduling for new vehicle registrations" flow) as an
 * alternative to picking an existing clienteId/vehiculoId.
 */
export function crearCita(input: CrearCitaInput): {
  cita: Cita;
  cliente: Cliente;
  vehiculo: Vehiculo;
} {
  const { cliente, vehiculo } = resolverClienteVehiculo(input);

  const cita = addCita({
    clienteId: cliente.id,
    vehiculoId: vehiculo.id,
    fecha: input.fecha,
    hora: input.hora,
    motivo: input.motivo,
    estado: "Programada",
  });

  return { cita, cliente, vehiculo };
}

function addOrden(data: Omit<OrdenTrabajo, "id">): OrdenTrabajo {
  const orden: OrdenTrabajo = { id: nextId("ord", ordenesTrabajo), ...data };
  ordenesTrabajo.push(orden);
  return orden;
}

export interface CrearOrdenInput extends ClienteVehiculoInput {
  diagnostico?: string;
  tipoOrden?: TipoOrden;
  kilometraje?: number | null;
  combustible?: NivelCombustible | null;
  horaIngreso?: string | null;
}

/**
 * Opens a brand-new work order directly on the Kanban board (starts in
 * "Ingresado"), for walk-ins or any car that isn't coming from a scheduled
 * Cita. Supports the same existing-vehicle / register-new-vehicle inline
 * paths as crearCita.
 */
export function crearOrden(input: CrearOrdenInput, actor: Actor): {
  orden: OrdenTrabajo;
  cliente: Cliente;
  vehiculo: Vehiculo;
} {
  const { cliente, vehiculo } = resolverClienteVehiculo(input);

  const orden = addOrden({
    citaId: null,
    vehiculoId: vehiculo.id,
    estadoKanban: "Ingresado",
    tipoOrden: input.tipoOrden ?? "Reparación",
    ordenOrigenId: null,
    diagnostico: input.diagnostico ?? "",
    kilometraje: input.kilometraje ?? null,
    combustible: input.combustible ?? null,
    horaIngreso: input.horaIngreso ?? new Date().toTimeString().slice(0, 5),
    horaSalida: null,
    notas: [],
    actividad: [],
    fotos: [],
    fechaIngreso: new Date().toISOString().slice(0, 10),
    fechaEntrega: null,
  });
  agregarActividad(orden, actor, "Creó la orden");

  return { orden, cliente, vehiculo };
}

/**
 * Reopens a previously delivered order as a brand-new order for the same
 * vehicle (e.g. the customer comes back because the issue wasn't fixed),
 * classified as either a paid "Reparación" or a "Garantía" redo. The
 * original order is left untouched — the Kanban board never rewinds a
 * finished job, it opens a new one and links back to it for traceability.
 */
export function reabrirOrden(ordenOrigenId: string, tipoOrden: TipoOrden, actor: Actor): OrdenTrabajo {
  const origen = getOrdenById(ordenOrigenId);
  if (!origen) throw new Error("Orden original no encontrada.");

  const orden = addOrden({
    citaId: null,
    vehiculoId: origen.vehiculoId,
    estadoKanban: "Ingresado",
    tipoOrden,
    ordenOrigenId,
    diagnostico: "",
    kilometraje: null,
    combustible: null,
    horaIngreso: new Date().toTimeString().slice(0, 5),
    horaSalida: null,
    notas: [],
    actividad: [],
    fotos: [],
    fechaIngreso: new Date().toISOString().slice(0, 10),
    fechaEntrega: null,
  });
  agregarActividad(orden, actor, `Reabrió la orden ${ordenOrigenId} como ${tipoOrden}`);
  return orden;
}

/** Advances or sets a work order's Kanban status (used by the dashboard board). */
export function moverOrdenEstado(ordenId: string, estado: EstadoKanban, actor: Actor): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  if (!ORDEN_ESTADOS.includes(estado)) throw new Error("Estado inválido.");
  orden.estadoKanban = estado;
  if (estado === "Entregado") {
    if (!orden.fechaEntrega) orden.fechaEntrega = new Date().toISOString().slice(0, 10);
    if (!orden.horaSalida) orden.horaSalida = new Date().toTimeString().slice(0, 5);
  }
  agregarActividad(orden, actor, `Movió la orden a "${estado}"`);
  return orden;
}

/** Appends a new evidence photo (a data: URL, or eventually a Drive link) to a work order. */
export function agregarFotoOrden(ordenId: string, url: string, actor: Actor): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  orden.fotos.push(url);
  agregarActividad(orden, actor, "Subió una foto de evidencia");
  return orden;
}

/** Adds a timestamped note to a work order — visible to every role, so
 *  mechanics and staff share one comment thread per order. */
export function agregarNotaOrden(ordenId: string, autor: string, rol: Rol, texto: string): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  const nota: NotaOrden = { autor, rol, texto, fecha: new Date().toISOString().slice(0, 10) };
  orden.notas.push(nota);
  return orden;
}

/**
 * Creates a Cotización for a work order that doesn't have one yet. The total
 * (13% IVA included) is always derived from the line items via
 * calcularTotalesCotizacion, never trusted from the client.
 */
export function crearCotizacion(ordenId: string, items: CotizacionItem[], actor: Actor): Cotizacion {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  if (getCotizacionByOrdenId(ordenId)) throw new Error("Esta orden ya tiene una cotización.");
  if (items.length === 0) throw new Error("Agregue al menos una línea a la cotización.");

  const { total } = calcularTotalesCotizacion(items);
  const cotizacion: Cotizacion = {
    id: nextId("cot", cotizaciones),
    ordenId,
    items,
    total,
    estado: "Pendiente",
    pagada: false,
    seguimiento: false,
    fechaSeguimiento: null,
    fecha: new Date().toISOString().slice(0, 10),
  };
  cotizaciones.push(cotizacion);
  agregarActividad(orden, actor, "Creó la cotización");
  return cotizacion;
}

/**
 * Records the client's decision on a Cotización. When rejecting, `seguimiento`
 * schedules a follow-up reminder 3 days out, per the shop's stated process.
 */
export function setCotizacionEstado(
  cotizacionId: string,
  estado: EstadoCotizacion,
  actor: Actor,
  seguimiento = false
): Cotizacion {
  const cotizacion = cotizaciones.find((c) => c.id === cotizacionId);
  if (!cotizacion) throw new Error("Cotización no encontrada.");
  cotizacion.estado = estado;

  if (estado === "Rechazada" && seguimiento) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 3);
    cotizacion.seguimiento = true;
    cotizacion.fechaSeguimiento = hoy.toISOString().slice(0, 10);
  } else if (estado !== "Rechazada") {
    cotizacion.seguimiento = false;
    cotizacion.fechaSeguimiento = null;
  }

  if (estado !== "Aprobada") cotizacion.pagada = false;

  const orden = getOrdenById(cotizacion.ordenId);
  if (orden) {
    const detalle = estado === "Rechazada" && seguimiento ? " (con seguimiento en 3 días)" : "";
    agregarActividad(orden, actor, `Marcó la cotización como "${estado}"${detalle}`);
  }
  return cotizacion;
}

/** Marks a Cotización as paid — only meaningful once it's been approved.
 *  This is also the boundary between the document reading "Orden" vs. "Factura". */
export function setCotizacionPagada(cotizacionId: string, pagada: boolean, actor: Actor): Cotizacion {
  const cotizacion = cotizaciones.find((c) => c.id === cotizacionId);
  if (!cotizacion) throw new Error("Cotización no encontrada.");
  if (pagada && cotizacion.estado !== "Aprobada") {
    throw new Error("Solo se puede marcar como pagada una cotización aprobada.");
  }
  cotizacion.pagada = pagada;

  const orden = getOrdenById(cotizacion.ordenId);
  if (orden) {
    agregarActividad(orden, actor, pagada ? "Marcó la cotización como pagada (Factura)" : "Revirtió el pago de la cotización");
  }
  return cotizacion;
}
