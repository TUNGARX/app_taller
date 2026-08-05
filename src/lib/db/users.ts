import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import type { Rol } from "@/lib/types";

const PASSWORD_MAX_AGE_DAYS = 90;

export interface Usuario {
  id: number;
  usuario: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
  debeCambiarPassword: 0 | 1;
  passwordChangedAt: string;
  createdAt: string;
}

export type UsuarioPublico = Omit<Usuario, "passwordHash">;

// Next.js dev (Turbopack) can instantiate this module more than once across
// Route Handlers vs. Server Components — stash the DB connection on
// `globalThis` so every part of the app shares the same open SQLite file,
// same pattern used by the business-data store (src/lib/db/negocio.ts).
declare global {
  var __tallerUsersDb: Database.Database | undefined;
}

function abrirDb(): Database.Database {
  if (globalThis.__tallerUsersDb) return globalThis.__tallerUsersDb;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "taller.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      debeCambiarPassword INTEGER NOT NULL DEFAULT 0,
      passwordChangedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      codeHash TEXT NOT NULL,
      usadoEn TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes(userId);
  `);

  globalThis.__tallerUsersDb = db;
  return db;
}

const db = abrirDb();

function validarPassword(password: string) {
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  if (/^\d+$/.test(password)) {
    throw new Error("La contraseña no puede ser solo números.");
  }
}

export function crearUsuario(input: {
  usuario: string;
  password: string;
  nombre: string;
  rol: Rol;
  debeCambiarPassword?: boolean;
}): UsuarioPublico {
  validarPassword(input.password);
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const ahora = new Date().toISOString();

  // Normalized the same way getUsuarioPorNombreUsuario compares — stores a
  // consistent form so a later login attempt (typed on a different
  // keyboard/device) still matches byte-for-byte where it matters (the
  // UNIQUE constraint), even though the actual lookup is itself tolerant.
  const usuarioNormalizado = input.usuario.trim().normalize("NFC");

  const resultado = db
    .prepare(
      `INSERT INTO users (usuario, passwordHash, nombre, rol, debeCambiarPassword, passwordChangedAt, createdAt)
       VALUES (@usuario, @passwordHash, @nombre, @rol, @debeCambiarPassword, @ahora, @ahora)`
    )
    .run({
      usuario: usuarioNormalizado,
      passwordHash,
      nombre: input.nombre,
      rol: input.rol,
      debeCambiarPassword: input.debeCambiarPassword ? 1 : 0,
      ahora,
    });

  return getUsuarioPublicoPorId(Number(resultado.lastInsertRowid))!;
}

/** Case- and Unicode-normalization-insensitive: a plain SQL `= ?` match is
 *  byte-for-byte, which silently fails when the same-looking username was
 *  typed on a different keyboard/device than the one used to create the
 *  account — e.g. an accented character stored in NFD form ("o" + combining
 *  accent) never matches the same character typed as a single NFC codepoint,
 *  even though both render identically. Staff accounts are few enough
 *  (a handful per shop) that comparing in JS instead of SQL costs nothing. */
export function getUsuarioPorNombreUsuario(usuario: string): Usuario | undefined {
  const buscado = usuario.trim().normalize("NFC").toLowerCase();
  const rows = db.prepare("SELECT * FROM users").all() as Usuario[];
  return rows.find((u) => u.usuario.normalize("NFC").toLowerCase() === buscado);
}

function aPublico(user: Usuario): UsuarioPublico {
  return {
    id: user.id,
    usuario: user.usuario,
    nombre: user.nombre,
    rol: user.rol,
    debeCambiarPassword: user.debeCambiarPassword,
    passwordChangedAt: user.passwordChangedAt,
    createdAt: user.createdAt,
  };
}

export function getUsuarioPublicoPorId(id: number): UsuarioPublico | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Usuario
    | undefined;
  return row ? aPublico(row) : undefined;
}

export function verificarPassword(user: Usuario, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

export function passwordExpirada(user: Usuario): boolean {
  const cambiada = new Date(user.passwordChangedAt).getTime();
  const diasTranscurridos = (Date.now() - cambiada) / (1000 * 60 * 60 * 24);
  return diasTranscurridos > PASSWORD_MAX_AGE_DAYS;
}

export function listarUsuarios(): UsuarioPublico[] {
  const rows = db
    .prepare("SELECT * FROM users ORDER BY createdAt ASC")
    .all() as Usuario[];
  return rows.map(aPublico);
}

function contarOwners(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE rol = 'Owner'").get() as {
    n: number;
  };
  return row.n;
}

/** Deletes a staff account (e.g. an employee who was let go or left).
 *  Past activity/notes attributed to them are untouched — those store the
 *  person's name as plain text, not a reference to this row, so the "who
 *  did what" history stays intact after the account is gone. */
export function eliminarUsuario(id: number): void {
  const usuario = getUsuarioPublicoPorId(id);
  if (!usuario) throw new Error("Usuario no encontrado.");
  if (usuario.rol === "Owner" && contarOwners() <= 1) {
    throw new Error("No se puede eliminar al único dueño registrado.");
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function cambiarPassword(userId: number, nuevaPassword: string): void {
  validarPassword(nuevaPassword);
  const passwordHash = bcrypt.hashSync(nuevaPassword, 10);
  db.prepare(
    "UPDATE users SET passwordHash = ?, passwordChangedAt = ?, debeCambiarPassword = 0 WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), userId);
}

/** Owner-triggered reset: sets a new temp password and forces the user to change it on next login. */
export function reiniciarPassword(userId: number, passwordTemporal: string): void {
  validarPassword(passwordTemporal);
  const passwordHash = bcrypt.hashSync(passwordTemporal, 10);
  db.prepare(
    "UPDATE users SET passwordHash = ?, passwordChangedAt = ?, debeCambiarPassword = 1 WHERE id = ?"
  ).run(passwordHash, new Date().toISOString(), userId);
}

// --- Self-service password recovery (no email/SMTP required) -----------------
// A fixed batch of one-time codes per user, shown once at generation time and
// stored only as bcrypt hashes (same treatment as the password itself) --
// each code resets the password exactly once, then is permanently spent.

// Excludes visually-ambiguous characters (0/O, 1/I/L) since these are meant
// to be handwritten or read off a screen under workshop conditions.
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CANTIDAD_CODIGOS = 8;

function generarCodigoAleatorio(): string {
  let codigo = "";
  for (let i = 0; i < 8; i++) {
    codigo += ALFABETO_CODIGO[crypto.randomInt(0, ALFABETO_CODIGO.length)];
  }
  return codigo;
}

function formatearCodigo(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

function normalizarCodigoIngresado(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Generates a fresh batch of recovery codes for a user, invalidating any
 *  previous batch. Returns the plaintext codes (formatted "XXXX-XXXX") --
 *  the only time they're ever visible, since only their bcrypt hashes are
 *  kept afterward. Called both right after creating a new account and
 *  on-demand from /staff to rotate an existing user's codes. */
export function generarCodigosRecuperacion(userId: number): string[] {
  const codigosPlanos = Array.from({ length: CANTIDAD_CODIGOS }, generarCodigoAleatorio);
  const ahora = new Date().toISOString();

  const regenerar = db.transaction(() => {
    db.prepare("DELETE FROM recovery_codes WHERE userId = ?").run(userId);
    const insertar = db.prepare(
      "INSERT INTO recovery_codes (userId, codeHash, createdAt) VALUES (?, ?, ?)"
    );
    for (const codigo of codigosPlanos) {
      insertar.run(userId, bcrypt.hashSync(codigo, 10), ahora);
    }
  });
  regenerar();

  return codigosPlanos.map(formatearCodigo);
}

/**
 * Validates a one-time recovery code for the given username and, if it
 * matches an unused one, sets the new password and marks that code spent --
 * both in a single transaction, so a code can never reset a password twice.
 * Returns false for any mismatch (unknown username, wrong/already-used
 * code) -- deliberately the same generic outcome for both, so a failed
 * attempt never reveals whether the username exists.
 */
export function restablecerPasswordConCodigo(
  usuarioInput: string,
  codigoInput: string,
  nuevaPassword: string
): boolean {
  const user = getUsuarioPorNombreUsuario(usuarioInput);
  if (!user) return false;

  const codigoNormalizado = normalizarCodigoIngresado(codigoInput);
  if (!codigoNormalizado) return false;

  const candidatos = db
    .prepare("SELECT id, codeHash FROM recovery_codes WHERE userId = ? AND usadoEn IS NULL")
    .all(user.id) as { id: number; codeHash: string }[];

  const coincidencia = candidatos.find((c) => bcrypt.compareSync(codigoNormalizado, c.codeHash));
  if (!coincidencia) return false;

  validarPassword(nuevaPassword);
  const passwordHash = bcrypt.hashSync(nuevaPassword, 10);
  const ahora = new Date().toISOString();

  const restablecer = db.transaction(() => {
    db.prepare(
      "UPDATE users SET passwordHash = ?, passwordChangedAt = ?, debeCambiarPassword = 0 WHERE id = ?"
    ).run(passwordHash, ahora, user.id);
    db.prepare("UPDATE recovery_codes SET usadoEn = ? WHERE id = ?").run(ahora, coincidencia.id);
  });
  restablecer();

  return true;
}

/** How many unused recovery codes a user still has left -- shown in /staff
 *  so an Owner knows when a batch is running low and worth regenerating. */
export function contarCodigosDisponibles(userId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM recovery_codes WHERE userId = ? AND usadoEn IS NULL")
    .get(userId) as { n: number };
  return row.n;
}
