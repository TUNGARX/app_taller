import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  ActividadOrden,
  Cita,
  Cliente,
  Cotizacion,
  CotizacionItem,
  EstadoCita,
  EstadoCotizacion,
  EstadoKanban,
  MediaOrden,
  NivelCombustible,
  NotaOrden,
  OrdenTrabajo,
  Rol,
  TipoMedia,
  TipoOrden,
  Vehiculo,
} from "@/lib/types";
import { ORDEN_ESTADOS } from "@/lib/types";
import { calcularTotalesCotizacion } from "@/lib/cotizacion-calc";

// This is the real, durable business-data store — replaces the old in-memory
// mock-db. Opens the same data/taller.db file the user-accounts store
// (src/lib/db/users.ts) uses, via its own connection/singleton (two
// synchronous better-sqlite3 connections to the same WAL-mode file, within
// one Node process, is safe — keeps this module fully independent from the
// working, tested auth code).
declare global {
  var __tallerNegocioDb: Database.Database | undefined;
}

function abrirDb(): Database.Database {
  if (globalThis.__tallerNegocioDb) return globalThis.__tallerNegocioDb;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "taller.db"));
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL,
      direccion TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehiculos (
      id TEXT PRIMARY KEY,
      clienteId TEXT NOT NULL,
      placa TEXT NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      anio INTEGER NOT NULL,
      color TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehiculos_cliente ON vehiculos(clienteId);

    CREATE TABLE IF NOT EXISTS citas (
      id TEXT PRIMARY KEY,
      clienteId TEXT NOT NULL,
      vehiculoId TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      motivo TEXT NOT NULL,
      estado TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_citas_vehiculo ON citas(vehiculoId);

    CREATE TABLE IF NOT EXISTS ordenes_trabajo (
      id TEXT PRIMARY KEY,
      citaId TEXT,
      vehiculoId TEXT NOT NULL,
      estadoKanban TEXT NOT NULL,
      tipoOrden TEXT NOT NULL,
      ordenOrigenId TEXT,
      diagnostico TEXT NOT NULL,
      kilometraje INTEGER,
      combustible TEXT,
      horaIngreso TEXT,
      horaSalida TEXT,
      fechaIngreso TEXT NOT NULL,
      fechaEntrega TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ordenes_vehiculo ON ordenes_trabajo(vehiculoId);

    CREATE TABLE IF NOT EXISTS orden_notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordenId TEXT NOT NULL,
      autor TEXT NOT NULL,
      rol TEXT NOT NULL,
      texto TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orden_notas_orden ON orden_notas(ordenId);

    CREATE TABLE IF NOT EXISTS orden_actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordenId TEXT NOT NULL,
      autor TEXT NOT NULL,
      rol TEXT NOT NULL,
      accion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orden_actividad_orden ON orden_actividad(ordenId);

    CREATE TABLE IF NOT EXISTS orden_fotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordenId TEXT NOT NULL,
      url TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orden_fotos_orden ON orden_fotos(ordenId);

    CREATE TABLE IF NOT EXISTS orden_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ordenId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      driveFileId TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnailUrl TEXT,
      mimeType TEXT NOT NULL,
      nombre TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orden_media_orden ON orden_media(ordenId);

    CREATE TABLE IF NOT EXISTS cotizaciones (
      id TEXT PRIMARY KEY,
      ordenId TEXT NOT NULL,
      total INTEGER NOT NULL,
      estado TEXT NOT NULL,
      pagada INTEGER NOT NULL DEFAULT 0,
      seguimiento INTEGER NOT NULL DEFAULT 0,
      fechaSeguimiento TEXT,
      fecha TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cotizaciones_orden ON cotizaciones(ordenId);

    CREATE TABLE IF NOT EXISTS cotizacion_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cotizacionId TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precioUnitario INTEGER NOT NULL,
      tipo TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cotizacion ON cotizacion_items(cotizacionId);

    CREATE TABLE IF NOT EXISTS contadores (
      prefix TEXT PRIMARY KEY,
      siguiente INTEGER NOT NULL
    );
  `);

  // Migration: `citas` predates the Google Calendar sync feature, so a
  // production DB already has rows without this column — add it once,
  // guarded by a pragma check, rather than relying on CREATE TABLE (a no-op
  // once the table already exists).
  const columnasCitas = db.prepare("PRAGMA table_info(citas)").all() as { name: string }[];
  if (!columnasCitas.some((c) => c.name === "eventoGoogleId")) {
    db.exec("ALTER TABLE citas ADD COLUMN eventoGoogleId TEXT");
  }

  globalThis.__tallerNegocioDb = db;
  return db;
}

const db = abrirDb();

function contarFilas(tabla: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get() as { n: number };
  return row.n;
}

/** Generates the next "{prefix}-001"-style id via a small counters table —
 *  safe even after deletions, unlike the old mock-db's `existing.length + 1`
 *  scheme. Kept in this format (not a raw autoincrement int) so nothing
 *  downstream — UI, printed Orden/Factura numbers — needs to change. */
function siguienteId(prefix: string): string {
  const row = db.prepare("SELECT siguiente FROM contadores WHERE prefix = ?").get(prefix) as
    | { siguiente: number }
    | undefined;
  const siguiente = row?.siguiente ?? 1;
  db.prepare(
    `INSERT INTO contadores (prefix, siguiente) VALUES (?, ?)
     ON CONFLICT(prefix) DO UPDATE SET siguiente = excluded.siguiente`
  ).run(prefix, siguiente + 1);
  return `${prefix}-${String(siguiente).padStart(3, "0")}`;
}

/** Seeds the same demo data the old mock-db shipped with, so a fresh
 *  checkout still boots with realistic sample data. Only runs once — no-op
 *  once real data exists. */
function seed(): void {
  if (contarFilas("clientes") > 0) return;

  const clientesSeed = [
    { id: "cli-001", nombre: "Marco Vargas Solís", telefono: "8888-1234", email: "marco.vargas@example.com", direccion: "San José, Curridabat, 200m sur del CENADA" },
    { id: "cli-002", nombre: "Ana Lucía Rojas Mora", telefono: "8712-5566", email: "ana.rojas@example.com", direccion: "Heredia, San Rafael, Residencial Los Ángeles" },
    { id: "cli-003", nombre: "Carlos Andrés Jiménez", telefono: "6050-9988", email: "carlos.jimenez@example.com", direccion: "Alajuela, La Guácima, calle Las Palmas" },
    { id: "cli-004", nombre: "Kimberly Castro Araya", telefono: "8399-4477", email: "kimberly.castro@example.com", direccion: "Cartago, Paraíso, frente a la iglesia" },
    { id: "cli-005", nombre: "Luis Fernando Quesada", telefono: "8654-2211", email: "luis.quesada@example.com", direccion: "San José, Desamparados, San Rafael Abajo" },
    { id: "cli-006", nombre: "Gabriela Méndez Chinchilla", telefono: "7070-3344", email: "gabriela.mendez@example.com", direccion: "Puntarenas, Esparza, Barrio San José" },
  ];

  const vehiculosSeed = [
    { id: "veh-001", clienteId: "cli-001", placa: "BPP123", marca: "Toyota", modelo: "Corolla", anio: 2018, color: "Gris" },
    { id: "veh-002", clienteId: "cli-002", placa: "CL456789", marca: "Hyundai", modelo: "Tucson", anio: 2021, color: "Blanco" },
    { id: "veh-003", clienteId: "cli-003", placa: "SJB234", marca: "Nissan", modelo: "Sentra", anio: 2016, color: "Rojo" },
    { id: "veh-004", clienteId: "cli-004", placa: "HB567890", marca: "Suzuki", modelo: "Grand Vitara", anio: 2019, color: "Negro" },
    { id: "veh-005", clienteId: "cli-005", placa: "CTG890", marca: "Kia", modelo: "Rio", anio: 2020, color: "Azul" },
    { id: "veh-006", clienteId: "cli-006", placa: "PUN345", marca: "Chevrolet", modelo: "Spark", anio: 2017, color: "Plateado" },
  ];

  const citasSeed = [
    { id: "cit-001", clienteId: "cli-001", vehiculoId: "veh-001", fecha: "2026-07-25", hora: "08:30", motivo: "Ruido en frenos delanteros", estado: "Completada" },
    { id: "cit-002", clienteId: "cli-002", vehiculoId: "veh-002", fecha: "2026-07-27", hora: "10:00", motivo: "Cambio de aceite y filtros", estado: "Completada" },
    { id: "cit-003", clienteId: "cli-003", vehiculoId: "veh-003", fecha: "2026-07-28", hora: "13:15", motivo: "Revisión de aire acondicionado", estado: "Confirmada" },
    { id: "cit-004", clienteId: "cli-004", vehiculoId: "veh-004", fecha: "2026-07-29", hora: "09:00", motivo: "Diagnóstico de luz de check engine", estado: "Programada" },
    { id: "cit-005", clienteId: "cli-005", vehiculoId: "veh-005", fecha: "2026-07-30", hora: "14:30", motivo: "Cambio de banda de tiempo", estado: "Programada" },
    { id: "cit-006", clienteId: "cli-006", vehiculoId: "veh-006", fecha: "2026-07-22", hora: "11:00", motivo: "Revisión previa a viaje largo", estado: "Cancelada" },
  ];

  const ordenesSeed = [
    { id: "ord-001", citaId: "cit-001", vehiculoId: "veh-001", estadoKanban: "Entregado", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "Pastillas de freno delanteras desgastadas, se reemplazaron junto con discos.", kilometraje: 82340, combustible: "1/2", horaIngreso: "08:15", horaSalida: "16:30", fechaIngreso: "2026-07-25", fechaEntrega: "2026-07-26", fotos: ["https://placehold.co/400x300?text=Foto+1", "https://placehold.co/400x300?text=Foto+2"] },
    { id: "ord-002", citaId: "cit-002", vehiculoId: "veh-002", estadoKanban: "Entregado", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "Cambio de aceite sintético 5W-30 y filtro de aire.", kilometraje: 41200, combustible: "3/4", horaIngreso: "10:00", horaSalida: "11:15", fechaIngreso: "2026-07-27", fechaEntrega: "2026-07-27", fotos: ["https://placehold.co/400x300?text=Foto+1"] },
    { id: "ord-003", citaId: "cit-003", vehiculoId: "veh-003", estadoKanban: "En Revisión", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "Posible fuga de gas refrigerante, pendiente de confirmar con manómetro.", kilometraje: 96500, combustible: "1/4", horaIngreso: "13:15", horaSalida: null, fechaIngreso: "2026-07-28", fechaEntrega: null, fotos: [] },
    { id: "ord-004", citaId: "cit-004", vehiculoId: "veh-004", estadoKanban: "Esperando Repuestos", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "Sensor de oxígeno defectuoso, se ordenó repuesto original.", kilometraje: 63780, combustible: "1/2", horaIngreso: "09:00", horaSalida: null, fechaIngreso: "2026-07-29", fechaEntrega: null, fotos: ["https://placehold.co/400x300?text=Foto+1"] },
    { id: "ord-005", citaId: "cit-005", vehiculoId: "veh-005", estadoKanban: "En Reparación", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "Banda de tiempo con desgaste visible, reemplazo en proceso.", kilometraje: 74020, combustible: "Lleno", horaIngreso: "14:30", horaSalida: null, fechaIngreso: "2026-07-30", fechaEntrega: null, fotos: [] },
    { id: "ord-006", citaId: null, vehiculoId: "veh-006", estadoKanban: "Ingresado", tipoOrden: "Reparación", ordenOrigenId: null, diagnostico: "", kilometraje: null, combustible: null, horaIngreso: "11:00", horaSalida: null, fechaIngreso: "2026-07-28", fechaEntrega: null, fotos: [] },
  ] as const;

  const cotizacionesSeed = [
    { id: "cot-001", ordenId: "ord-001", total: 164980, estado: "Aprobada", pagada: 1, seguimiento: 0, fechaSeguimiento: null, fecha: "2026-07-25", items: [
      { descripcion: "Pastillas de freno delanteras", cantidad: 1, precioUnitario: 45000, tipo: "Repuesto" },
      { descripcion: "Discos de freno delanteros", cantidad: 2, precioUnitario: 38000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 25000, tipo: "Mano de Obra" },
    ] },
    { id: "cot-002", ordenId: "ord-002", total: 56500, estado: "Aprobada", pagada: 1, seguimiento: 0, fechaSeguimiento: null, fecha: "2026-07-27", items: [
      { descripcion: "Aceite sintético 5W-30 (4L)", cantidad: 1, precioUnitario: 32000, tipo: "Repuesto" },
      { descripcion: "Filtro de aceite", cantidad: 1, precioUnitario: 8000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 10000, tipo: "Mano de Obra" },
    ] },
    { id: "cot-003", ordenId: "ord-004", total: 90400, estado: "Rechazada", pagada: 0, seguimiento: 1, fechaSeguimiento: "2026-08-01", fecha: "2026-07-29", items: [
      { descripcion: "Sensor de oxígeno original", cantidad: 1, precioUnitario: 65000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 15000, tipo: "Mano de Obra" },
    ] },
    { id: "cot-004", ordenId: "ord-005", total: 220350, estado: "Aprobada", pagada: 0, seguimiento: 0, fechaSeguimiento: null, fecha: "2026-07-30", items: [
      { descripcion: "Banda de tiempo (kit completo)", cantidad: 1, precioUnitario: 95000, tipo: "Repuesto" },
      { descripcion: "Bomba de agua", cantidad: 1, precioUnitario: 40000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 60000, tipo: "Mano de Obra" },
    ] },
  ] as const;

  const sembrar = db.transaction(() => {
    const insertCliente = db.prepare(
      "INSERT INTO clientes (id, nombre, telefono, email, direccion) VALUES (@id, @nombre, @telefono, @email, @direccion)"
    );
    for (const c of clientesSeed) insertCliente.run(c);

    const insertVehiculo = db.prepare(
      "INSERT INTO vehiculos (id, clienteId, placa, marca, modelo, anio, color) VALUES (@id, @clienteId, @placa, @marca, @modelo, @anio, @color)"
    );
    for (const v of vehiculosSeed) insertVehiculo.run(v);

    const insertCita = db.prepare(
      "INSERT INTO citas (id, clienteId, vehiculoId, fecha, hora, motivo, estado) VALUES (@id, @clienteId, @vehiculoId, @fecha, @hora, @motivo, @estado)"
    );
    for (const c of citasSeed) insertCita.run(c);

    const insertOrden = db.prepare(`
      INSERT INTO ordenes_trabajo
        (id, citaId, vehiculoId, estadoKanban, tipoOrden, ordenOrigenId, diagnostico, kilometraje, combustible, horaIngreso, horaSalida, fechaIngreso, fechaEntrega)
      VALUES
        (@id, @citaId, @vehiculoId, @estadoKanban, @tipoOrden, @ordenOrigenId, @diagnostico, @kilometraje, @combustible, @horaIngreso, @horaSalida, @fechaIngreso, @fechaEntrega)
    `);
    const insertFoto = db.prepare("INSERT INTO orden_fotos (ordenId, url) VALUES (?, ?)");
    for (const o of ordenesSeed) {
      const { fotos, ...campos } = o;
      insertOrden.run(campos);
      for (const url of fotos) insertFoto.run(o.id, url);
    }

    const insertCotizacion = db.prepare(`
      INSERT INTO cotizaciones (id, ordenId, total, estado, pagada, seguimiento, fechaSeguimiento, fecha)
      VALUES (@id, @ordenId, @total, @estado, @pagada, @seguimiento, @fechaSeguimiento, @fecha)
    `);
    const insertItem = db.prepare(
      "INSERT INTO cotizacion_items (cotizacionId, descripcion, cantidad, precioUnitario, tipo) VALUES (?, ?, ?, ?, ?)"
    );
    for (const cot of cotizacionesSeed) {
      const { items, ...campos } = cot;
      insertCotizacion.run(campos);
      for (const item of items) {
        insertItem.run(cot.id, item.descripcion, item.cantidad, item.precioUnitario, item.tipo);
      }
    }

    const insertContador = db.prepare("INSERT INTO contadores (prefix, siguiente) VALUES (?, ?)");
    insertContador.run("cli", clientesSeed.length + 1);
    insertContador.run("veh", vehiculosSeed.length + 1);
    insertContador.run("cit", citasSeed.length + 1);
    insertContador.run("ord", ordenesSeed.length + 1);
    insertContador.run("cot", cotizacionesSeed.length + 1);
  });

  sembrar();
}

seed();

// --- Row shapes (raw DB columns, before reconstructing embedded arrays) -----

interface OrdenRow {
  id: string;
  citaId: string | null;
  vehiculoId: string;
  estadoKanban: EstadoKanban;
  tipoOrden: TipoOrden;
  ordenOrigenId: string | null;
  diagnostico: string;
  kilometraje: number | null;
  combustible: NivelCombustible | null;
  horaIngreso: string | null;
  horaSalida: string | null;
  fechaIngreso: string;
  fechaEntrega: string | null;
}

interface CotizacionRow {
  id: string;
  ordenId: string;
  total: number;
  estado: EstadoCotizacion;
  pagada: 0 | 1;
  seguimiento: 0 | 1;
  fechaSeguimiento: string | null;
  fecha: string;
}

function obtenerNotas(ordenId: string): NotaOrden[] {
  return db
    .prepare("SELECT autor, rol, texto, fecha FROM orden_notas WHERE ordenId = ? ORDER BY id ASC")
    .all(ordenId) as NotaOrden[];
}

function obtenerActividad(ordenId: string): ActividadOrden[] {
  return db
    .prepare("SELECT autor, rol, accion, fecha, hora FROM orden_actividad WHERE ordenId = ? ORDER BY id ASC")
    .all(ordenId) as ActividadOrden[];
}

function obtenerFotos(ordenId: string): string[] {
  const rows = db.prepare("SELECT url FROM orden_fotos WHERE ordenId = ? ORDER BY id ASC").all(ordenId) as {
    url: string;
  }[];
  return rows.map((r) => r.url);
}

function obtenerMedia(ordenId: string): MediaOrden[] {
  return db
    .prepare(
      "SELECT id, tipo, driveFileId, url, thumbnailUrl, mimeType, nombre, fecha FROM orden_media WHERE ordenId = ? ORDER BY id ASC"
    )
    .all(ordenId) as MediaOrden[];
}

function obtenerItems(cotizacionId: string): CotizacionItem[] {
  return db
    .prepare(
      "SELECT descripcion, cantidad, precioUnitario, tipo FROM cotizacion_items WHERE cotizacionId = ? ORDER BY id ASC"
    )
    .all(cotizacionId) as CotizacionItem[];
}

function rowToOrden(row: OrdenRow): OrdenTrabajo {
  return {
    id: row.id,
    citaId: row.citaId,
    vehiculoId: row.vehiculoId,
    estadoKanban: row.estadoKanban,
    tipoOrden: row.tipoOrden,
    ordenOrigenId: row.ordenOrigenId,
    diagnostico: row.diagnostico,
    kilometraje: row.kilometraje,
    combustible: row.combustible,
    horaIngreso: row.horaIngreso,
    horaSalida: row.horaSalida,
    notas: obtenerNotas(row.id),
    actividad: obtenerActividad(row.id),
    fotos: obtenerFotos(row.id),
    media: obtenerMedia(row.id),
    fechaIngreso: row.fechaIngreso,
    fechaEntrega: row.fechaEntrega,
  };
}

function rowToCotizacion(row: CotizacionRow): Cotizacion {
  return {
    id: row.id,
    ordenId: row.ordenId,
    items: obtenerItems(row.id),
    total: row.total,
    estado: row.estado,
    pagada: !!row.pagada,
    seguimiento: !!row.seguimiento,
    fechaSeguimiento: row.fechaSeguimiento,
    fecha: row.fecha,
  };
}

// --- Accessor functions -----------------------------------------------------

export function getClienteById(id: string): Cliente | undefined {
  return db.prepare("SELECT * FROM clientes WHERE id = ?").get(id) as Cliente | undefined;
}

export function getVehiculoById(id: string): Vehiculo | undefined {
  return db.prepare("SELECT * FROM vehiculos WHERE id = ?").get(id) as Vehiculo | undefined;
}

function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function getVehiculoByPlaca(placa: string): Vehiculo | undefined {
  const normalized = normalizePlaca(placa);
  const rows = db.prepare("SELECT * FROM vehiculos").all() as Vehiculo[];
  return rows.find((v) => v.placa.replace(/[\s-]/g, "") === normalized);
}

export function getVehiculosByClienteId(clienteId: string): Vehiculo[] {
  return db.prepare("SELECT * FROM vehiculos WHERE clienteId = ?").all(clienteId) as Vehiculo[];
}

export function getCitasByVehiculoId(vehiculoId: string): Cita[] {
  return db.prepare("SELECT * FROM citas WHERE vehiculoId = ?").all(vehiculoId) as Cita[];
}

export function getOrdenesByVehiculoId(vehiculoId: string): OrdenTrabajo[] {
  const rows = db.prepare("SELECT * FROM ordenes_trabajo WHERE vehiculoId = ?").all(vehiculoId) as OrdenRow[];
  return rows.map(rowToOrden);
}

export function getOrdenesByEstado(estado: EstadoKanban): OrdenTrabajo[] {
  const rows = db.prepare("SELECT * FROM ordenes_trabajo WHERE estadoKanban = ?").all(estado) as OrdenRow[];
  return rows.map(rowToOrden);
}

export function getOrdenById(id: string): OrdenTrabajo | undefined {
  const row = db.prepare("SELECT * FROM ordenes_trabajo WHERE id = ?").get(id) as OrdenRow | undefined;
  return row ? rowToOrden(row) : undefined;
}

export function getCotizacionByOrdenId(ordenId: string): Cotizacion | undefined {
  const row = db.prepare("SELECT * FROM cotizaciones WHERE ordenId = ?").get(ordenId) as CotizacionRow | undefined;
  return row ? rowToCotizacion(row) : undefined;
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
  const cita = db.prepare("SELECT * FROM citas WHERE id = ?").get(citaId) as Cita | undefined;
  if (!cita) throw new Error("Cita no encontrada.");
  db.prepare("UPDATE citas SET estado = ? WHERE id = ?").run(estado, citaId);
  return { ...cita, estado };
}

/** Stores the Google Calendar event id created for a Cita (or clears it once
 *  the event has been deleted), so the sync only ever needs one lookup. */
export function setCitaEventoGoogle(citaId: string, eventoGoogleId: string | null): void {
  db.prepare("UPDATE citas SET eventoGoogleId = ? WHERE id = ?").run(eventoGoogleId, citaId);
}

/** All citas, newest first, with the cliente/vehiculo already resolved for display. */
export function getCitasConDetalle() {
  const rows = db.prepare("SELECT * FROM citas").all() as Cita[];
  return rows
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
  const rows = db
    .prepare("SELECT * FROM cotizaciones WHERE estado = 'Rechazada' AND seguimiento = 1 AND fechaSeguimiento <= ?")
    .all(hoy) as CotizacionRow[];
  return rows.map(rowToCotizacion).map((cotizacion) => {
    const orden = getOrdenById(cotizacion.ordenId);
    const vehiculo = orden ? getVehiculoById(orden.vehiculoId) : undefined;
    const cliente = vehiculo ? getClienteById(vehiculo.clienteId) : undefined;
    return { cotizacion, orden, vehiculo, cliente };
  });
}

/** Full listing functions — replace the old mock-db's raw array exports. */
export function listarClientes(): Cliente[] {
  return db.prepare("SELECT * FROM clientes").all() as Cliente[];
}

export function listarVehiculos(): Vehiculo[] {
  return db.prepare("SELECT * FROM vehiculos").all() as Vehiculo[];
}

export function listarCitas(): Cita[] {
  return db.prepare("SELECT * FROM citas").all() as Cita[];
}

export function listarOrdenes(): OrdenTrabajo[] {
  const rows = db.prepare("SELECT * FROM ordenes_trabajo").all() as OrdenRow[];
  return rows.map(rowToOrden);
}

export function listarCotizaciones(): Cotizacion[] {
  const rows = db.prepare("SELECT * FROM cotizaciones").all() as CotizacionRow[];
  return rows.map(rowToCotizacion);
}

// --- Mutations ---------------------------------------------------------------

/** Who performed a mutating action — every card action gets attributed to
 *  one of these so more than one person sharing a role stays distinguishable. */
export interface Actor {
  autor: string;
  rol: Rol;
}

/** Appends an audit-trail entry to a work order. Called internally by every
 *  action that changes an order or its Cotización — this is the shop's
 *  "who did what, and when" card history. */
function agregarActividad(ordenId: string, actor: Actor, accion: string): void {
  const ahora = new Date();
  db.prepare("INSERT INTO orden_actividad (ordenId, autor, rol, accion, fecha, hora) VALUES (?, ?, ?, ?, ?, ?)").run(
    ordenId,
    actor.autor,
    actor.rol,
    accion,
    ahora.toISOString().slice(0, 10),
    ahora.toTimeString().slice(0, 5)
  );
}

export function addCliente(data: Omit<Cliente, "id">): Cliente {
  const id = siguienteId("cli");
  db.prepare("INSERT INTO clientes (id, nombre, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)").run(
    id,
    data.nombre,
    data.telefono,
    data.email,
    data.direccion
  );
  return { id, ...data };
}

export function addVehiculo(data: Omit<Vehiculo, "id">): Vehiculo {
  const id = siguienteId("veh");
  db.prepare("INSERT INTO vehiculos (id, clienteId, placa, marca, modelo, anio, color) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id,
    data.clienteId,
    data.placa,
    data.marca,
    data.modelo,
    data.anio,
    data.color
  );
  return { id, ...data };
}

function addCita(data: Omit<Cita, "id">): Cita {
  const id = siguienteId("cit");
  db.prepare(
    "INSERT INTO citas (id, clienteId, vehiculoId, fecha, hora, motivo, estado) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.clienteId, data.vehiculoId, data.fecha, data.hora, data.motivo, data.estado);
  return { id, ...data };
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
      db.prepare("UPDATE vehiculos SET clienteId = ?, marca = ?, modelo = ?, anio = ?, color = ? WHERE id = ?").run(
        cliente.id,
        input.vehiculoNuevo.marca,
        input.vehiculoNuevo.modelo,
        input.vehiculoNuevo.anio,
        input.vehiculoNuevo.color,
        existente.id
      );
      vehiculo = {
        ...existente,
        clienteId: cliente.id,
        marca: input.vehiculoNuevo.marca,
        modelo: input.vehiculoNuevo.modelo,
        anio: input.vehiculoNuevo.anio,
        color: input.vehiculoNuevo.color,
      };
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
    eventoGoogleId: null,
  });

  return { cita, cliente, vehiculo };
}

export interface CrearOrdenInput extends ClienteVehiculoInput {
  diagnostico?: string;
  tipoOrden?: TipoOrden;
  kilometraje?: number | null;
  combustible?: NivelCombustible | null;
  horaIngreso?: string | null;
}

const insertarOrdenYActividad = db.transaction(
  (
    id: string,
    campos: {
      citaId: string | null;
      vehiculoId: string;
      estadoKanban: EstadoKanban;
      tipoOrden: TipoOrden;
      ordenOrigenId: string | null;
      diagnostico: string;
      kilometraje: number | null;
      combustible: NivelCombustible | null;
      horaIngreso: string | null;
      horaSalida: string | null;
      fechaIngreso: string;
      fechaEntrega: string | null;
    },
    actor: Actor,
    accion: string
  ): void => {
    db.prepare(
      `INSERT INTO ordenes_trabajo
        (id, citaId, vehiculoId, estadoKanban, tipoOrden, ordenOrigenId, diagnostico, kilometraje, combustible, horaIngreso, horaSalida, fechaIngreso, fechaEntrega)
       VALUES
        (@id, @citaId, @vehiculoId, @estadoKanban, @tipoOrden, @ordenOrigenId, @diagnostico, @kilometraje, @combustible, @horaIngreso, @horaSalida, @fechaIngreso, @fechaEntrega)`
    ).run({ id, ...campos });
    agregarActividad(id, actor, accion);
  }
);

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

  const id = siguienteId("ord");
  insertarOrdenYActividad(
    id,
    {
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
      fechaIngreso: new Date().toISOString().slice(0, 10),
      fechaEntrega: null,
    },
    actor,
    "Creó la orden"
  );

  return { orden: getOrdenById(id)!, cliente, vehiculo };
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

  const id = siguienteId("ord");
  insertarOrdenYActividad(
    id,
    {
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
      fechaIngreso: new Date().toISOString().slice(0, 10),
      fechaEntrega: null,
    },
    actor,
    `Reabrió la orden ${ordenOrigenId} como ${tipoOrden}`
  );

  return getOrdenById(id)!;
}

/** Advances or sets a work order's Kanban status (used by the dashboard board). */
export function moverOrdenEstado(ordenId: string, estado: EstadoKanban, actor: Actor): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  if (!ORDEN_ESTADOS.includes(estado)) throw new Error("Estado inválido.");

  let fechaEntrega = orden.fechaEntrega;
  let horaSalida = orden.horaSalida;
  if (estado === "Entregado") {
    if (!fechaEntrega) fechaEntrega = new Date().toISOString().slice(0, 10);
    if (!horaSalida) horaSalida = new Date().toTimeString().slice(0, 5);
  }

  db.prepare("UPDATE ordenes_trabajo SET estadoKanban = ?, fechaEntrega = ?, horaSalida = ? WHERE id = ?").run(
    estado,
    fechaEntrega,
    horaSalida,
    ordenId
  );
  agregarActividad(ordenId, actor, `Movió la orden a "${estado}"`);
  return getOrdenById(ordenId)!;
}

/** Appends a new evidence photo (a data: URL, or eventually a Drive link) to a work order. */
export function agregarFotoOrden(ordenId: string, url: string, actor: Actor): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  db.prepare("INSERT INTO orden_fotos (ordenId, url) VALUES (?, ?)").run(ordenId, url);
  agregarActividad(ordenId, actor, "Subió una foto de evidencia");
  return getOrdenById(ordenId)!;
}

export interface NuevoMediaInput {
  tipo: TipoMedia;
  driveFileId: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  nombre: string;
}

/**
 * Records a Drive-backed photo/video pointer for a work order. Only allowed
 * while the order hasn't reached "Entregado" — once a job is delivered the
 * Kanban board never reopens that card (a returning vehicle gets a brand-new
 * order via reabrirOrden instead), so evidence for a delivered order is
 * considered final.
 */
export function agregarMediaOrden(ordenId: string, media: NuevoMediaInput, actor: Actor): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  if (orden.estadoKanban === "Entregado") {
    throw new Error("No se puede agregar evidencia a una orden ya entregada.");
  }

  db.prepare(
    `INSERT INTO orden_media (ordenId, tipo, driveFileId, url, thumbnailUrl, mimeType, nombre, fecha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ordenId,
    media.tipo,
    media.driveFileId,
    media.url,
    media.thumbnailUrl,
    media.mimeType,
    media.nombre,
    new Date().toISOString().slice(0, 10)
  );
  agregarActividad(ordenId, actor, media.tipo === "video" ? "Subió un video de evidencia" : "Subió una foto de evidencia");
  return getOrdenById(ordenId)!;
}

/** Adds a timestamped note to a work order — visible to every role, so
 *  mechanics and staff share one comment thread per order. */
export function agregarNotaOrden(ordenId: string, autor: string, rol: Rol, texto: string): OrdenTrabajo {
  const orden = getOrdenById(ordenId);
  if (!orden) throw new Error("Orden no encontrada.");
  db.prepare("INSERT INTO orden_notas (ordenId, autor, rol, texto, fecha) VALUES (?, ?, ?, ?, ?)").run(
    ordenId,
    autor,
    rol,
    texto,
    new Date().toISOString().slice(0, 10)
  );
  return getOrdenById(ordenId)!;
}

const insertarCotizacionYActividad = db.transaction(
  (id: string, ordenId: string, items: CotizacionItem[], total: number, fecha: string, actor: Actor): void => {
    db.prepare(
      `INSERT INTO cotizaciones (id, ordenId, total, estado, pagada, seguimiento, fechaSeguimiento, fecha)
       VALUES (?, ?, ?, 'Pendiente', 0, 0, NULL, ?)`
    ).run(id, ordenId, total, fecha);

    const insertItem = db.prepare(
      "INSERT INTO cotizacion_items (cotizacionId, descripcion, cantidad, precioUnitario, tipo) VALUES (?, ?, ?, ?, ?)"
    );
    for (const item of items) {
      insertItem.run(id, item.descripcion, item.cantidad, item.precioUnitario, item.tipo);
    }

    agregarActividad(ordenId, actor, "Creó la cotización");
  }
);

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
  const id = siguienteId("cot");
  insertarCotizacionYActividad(id, ordenId, items, total, new Date().toISOString().slice(0, 10), actor);

  return getCotizacionByOrdenId(ordenId)!;
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
  const row = db.prepare("SELECT * FROM cotizaciones WHERE id = ?").get(cotizacionId) as CotizacionRow | undefined;
  if (!row) throw new Error("Cotización no encontrada.");

  let seguimientoNuevo = row.seguimiento;
  let fechaSeguimientoNueva = row.fechaSeguimiento;

  if (estado === "Rechazada" && seguimiento) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 3);
    seguimientoNuevo = 1;
    fechaSeguimientoNueva = hoy.toISOString().slice(0, 10);
  } else if (estado !== "Rechazada") {
    seguimientoNuevo = 0;
    fechaSeguimientoNueva = null;
  }

  const pagadaNueva = estado === "Aprobada" ? row.pagada : 0;

  db.prepare("UPDATE cotizaciones SET estado = ?, seguimiento = ?, fechaSeguimiento = ?, pagada = ? WHERE id = ?").run(
    estado,
    seguimientoNuevo,
    fechaSeguimientoNueva,
    pagadaNueva,
    cotizacionId
  );

  const detalle = estado === "Rechazada" && seguimiento ? " (con seguimiento en 3 días)" : "";
  agregarActividad(row.ordenId, actor, `Marcó la cotización como "${estado}"${detalle}`);

  return rowToCotizacion({
    ...row,
    estado,
    seguimiento: seguimientoNuevo,
    fechaSeguimiento: fechaSeguimientoNueva,
    pagada: pagadaNueva,
  });
}

/** Marks a Cotización as paid — only meaningful once it's been approved.
 *  This is also the boundary between the document reading "Orden" vs. "Factura". */
export function setCotizacionPagada(cotizacionId: string, pagada: boolean, actor: Actor): Cotizacion {
  const row = db.prepare("SELECT * FROM cotizaciones WHERE id = ?").get(cotizacionId) as CotizacionRow | undefined;
  if (!row) throw new Error("Cotización no encontrada.");
  if (pagada && row.estado !== "Aprobada") {
    throw new Error("Solo se puede marcar como pagada una cotización aprobada.");
  }
  db.prepare("UPDATE cotizaciones SET pagada = ? WHERE id = ?").run(pagada ? 1 : 0, cotizacionId);

  agregarActividad(
    row.ordenId,
    actor,
    pagada ? "Marcó la cotización como pagada (Factura)" : "Revirtió el pago de la cotización"
  );
  return rowToCotizacion({ ...row, pagada: pagada ? 1 : 0 });
}

// --- Backup export/restore ---------------------------------------------------
// Used by the CSV/ZIP backup feature (src/lib/backup/exportar.ts) and the
// developer-run restore script (scripts/restaurar-respaldo.ts). Kept here,
// not in those files, because only this module should ever touch raw SQL —
// same rule as the rest of the app's data access.

/** Tables in FK-safe order: parents before their children, used for both
 *  export ordering (cosmetic) and restore ordering (required — a child row
 *  must never be inserted before the parent it references). */
const TABLAS_RESPALDO = [
  "clientes",
  "vehiculos",
  "citas",
  "ordenes_trabajo",
  "orden_notas",
  "orden_actividad",
  "orden_fotos",
  "orden_media",
  "cotizaciones",
  "cotizacion_items",
] as const;

export type NombreTablaRespaldo = (typeof TABLAS_RESPALDO)[number];

/** Raw rows for every business table — the export module turns these into
 *  CSVs, the restore script parses CSVs back into this same shape. */
export function exportarTablas(): Record<NombreTablaRespaldo, Record<string, unknown>[]> {
  const resultado = {} as Record<NombreTablaRespaldo, Record<string, unknown>[]>;
  for (const tabla of TABLAS_RESPALDO) {
    resultado[tabla] = db.prepare(`SELECT * FROM ${tabla}`).all() as Record<string, unknown>[];
  }
  return resultado;
}

const PREFIJO_POR_TABLA: Partial<Record<NombreTablaRespaldo, string>> = {
  clientes: "cli",
  vehiculos: "veh",
  citas: "cit",
  ordenes_trabajo: "ord",
  cotizaciones: "cot",
};

/**
 * Wipes every business table and re-inserts the given rows — the disaster-
 * recovery path for the CSV/ZIP backup. Runs inside a single transaction: if
 * anything throws partway through, the whole restore rolls back and the live
 * DB is left exactly as it was, never left half-wiped.
 *
 * Re-derives the id counters from the highest numeric suffix found per
 * prefix, so new records created after a restore continue the sequence
 * instead of colliding with restored ids.
 */
export function importarTablas(datos: Partial<Record<NombreTablaRespaldo, Record<string, unknown>[]>>): void {
  const restaurar = db.transaction(() => {
    for (const tabla of [...TABLAS_RESPALDO].reverse()) {
      db.exec(`DELETE FROM ${tabla}`);
    }
    db.exec("DELETE FROM contadores");

    for (const tabla of TABLAS_RESPALDO) {
      const filas = datos[tabla] ?? [];
      if (filas.length === 0) continue;
      const columnas = Object.keys(filas[0]);
      const asignaciones = columnas.map((c) => `@${c}`).join(", ");
      const insertar = db.prepare(`INSERT INTO ${tabla} (${columnas.join(", ")}) VALUES (${asignaciones})`);
      for (const fila of filas) insertar.run(fila);
    }

    for (const [tabla, prefix] of Object.entries(PREFIJO_POR_TABLA)) {
      const rows = db.prepare(`SELECT id FROM ${tabla}`).all() as { id: string }[];
      const maxSecuencia = rows.reduce((max, row) => {
        const n = Number(row.id.split("-")[1]);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);
      db.prepare("INSERT INTO contadores (prefix, siguiente) VALUES (?, ?)").run(prefix, maxSecuencia + 1);
    }
  });

  restaurar();
}
