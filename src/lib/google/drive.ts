import { Readable } from "node:stream";
import { getDriveClient } from "./client";

// Drive layout: one root folder named "Automotivo" owned by the taller's
// account, with one subfolder per vehicle plate directly under it. Every
// evidence photo/video for that plate — across every order, regardless of
// client — lands in that single per-plate folder, which is what keeps the
// history tied to the plate rather than to whichever client currently owns
// the vehicle (same rule the SQLite history already follows).
const NOMBRE_CARPETA_RAIZ = "Automotivo";
const CARPETA_MIME = "application/vnd.google-apps.folder";

let carpetaRaizIdCache: string | undefined;

async function buscarCarpeta(nombre: string, padreId?: string): Promise<string | undefined> {
  const drive = getDriveClient();
  const partesQuery = [
    `mimeType = '${CARPETA_MIME}'`,
    `name = '${nombre.replace(/'/g, "\\'")}'`,
    "trashed = false",
  ];
  if (padreId) partesQuery.push(`'${padreId}' in parents`);

  const res = await drive.files.list({
    q: partesQuery.join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? undefined;
}

async function crearCarpeta(nombre: string, padreId?: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: CARPETA_MIME,
      parents: padreId ? [padreId] : undefined,
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`No se pudo crear la carpeta "${nombre}" en Drive.`);
  return res.data.id;
}

async function getOrCreateCarpeta(nombre: string, padreId?: string): Promise<string> {
  const existente = await buscarCarpeta(nombre, padreId);
  if (existente) return existente;
  return crearCarpeta(nombre, padreId);
}

async function getOrCreateCarpetaRaiz(): Promise<string> {
  if (carpetaRaizIdCache) return carpetaRaizIdCache;
  const id = await getOrCreateCarpeta(NOMBRE_CARPETA_RAIZ);
  carpetaRaizIdCache = id;
  return id;
}

/** Normalizes the same way src/lib/db/negocio.ts does, so a plate always
 *  resolves to the same Drive folder regardless of spacing/hyphens/case. */
function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Returns the Drive folder id for a plate, creating it under "Automotivo"
 *  if this is the first upload for that vehicle. */
export async function getOrCreateCarpetaPlaca(placa: string): Promise<string> {
  const raizId = await getOrCreateCarpetaRaiz();
  return getOrCreateCarpeta(normalizePlaca(placa), raizId);
}

export interface ArchivoSubido {
  id: string;
  webViewLink: string;
  thumbnailLink: string | null;
  mimeType: string;
}

/** Uploads one file (photo or video buffer) into the given plate's folder. */
export async function subirArchivoPlaca(
  placa: string,
  buffer: Buffer,
  nombre: string,
  mimeType: string
): Promise<ArchivoSubido> {
  const drive = getDriveClient();
  const carpetaId = await getOrCreateCarpetaPlaca(placa);

  const res = await drive.files.create({
    requestBody: { name: nombre, parents: [carpetaId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink, thumbnailLink, mimeType",
  });

  if (!res.data.id || !res.data.webViewLink) {
    throw new Error("No se pudo subir el archivo a Google Drive.");
  }

  // The client portal (src/app/(portal)/buscar) shows evidence to vehicle
  // owners without requiring them to sign in with Google, so each file needs
  // to be link-viewable — otherwise webViewLink/thumbnailLink 404 for them
  // even though the taller's own account can see it fine.
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { type: "anyone", role: "reader" },
  });

  return {
    id: res.data.id,
    webViewLink: res.data.webViewLink,
    thumbnailLink: res.data.thumbnailLink ?? null,
    mimeType: res.data.mimeType ?? mimeType,
  };
}

/** Deletes a file from Drive (e.g. if an upload needs to be retracted). */
export async function eliminarArchivo(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}
