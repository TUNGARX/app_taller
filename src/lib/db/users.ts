import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
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
