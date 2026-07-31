// Disaster-recovery restore for the CSV/ZIP backup downloaded from
// /staff ("Descargar respaldo (.zip)"). Deliberately NOT exposed in the app —
// a full wipe-and-restore is a rare, high-stakes action, so this only runs
// when a developer deliberately invokes it, never via a misclick in the UI.
//
// Usage: npx tsx scripts/restaurar-respaldo.ts <ruta-al-zip> --confirmar
//
// Wipes every business table (clientes, vehiculos, citas, ordenes_trabajo and
// its child tables, cotizaciones and its items) and re-inserts everything
// from the backup, inside a single transaction — if anything fails partway
// through, the live DB is left untouched. Never touches the `users` table
// (staff accounts/passwords aren't part of this backup).
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import Papa from "papaparse";
import { importarTablas, type NombreTablaRespaldo } from "../src/lib/db/negocio";

const TABLAS = [
  "clientes",
  "vehiculos",
  "citas",
  "ordenes_trabajo",
  "orden_notas",
  "orden_actividad",
  "orden_fotos",
  "cotizaciones",
  "cotizacion_items",
] as const satisfies readonly NombreTablaRespaldo[];

// Columns whose empty CSV cell means NULL, not the empty string "" — every
// other column keeps "" as a real empty string (e.g. Orden.diagnostico is
// NOT NULL and defaults to "", it must never become null on restore).
const COLUMNAS_NULEABLES: Partial<Record<NombreTablaRespaldo, string[]>> = {
  ordenes_trabajo: ["citaId", "ordenOrigenId", "kilometraje", "combustible", "horaIngreso", "horaSalida", "fechaEntrega"],
  cotizaciones: ["fechaSeguimiento"],
};

// Columns that must be restored as numbers, not strings — CSV cells are all
// plain text, so these need an explicit cast (deliberately NOT using
// Papa.parse's dynamicTyping: it converts every empty cell to null, not just
// genuinely nullable ones, which would corrupt NOT NULL text columns like
// diagnostico).
const COLUMNAS_NUMERICAS: Partial<Record<NombreTablaRespaldo, string[]>> = {
  vehiculos: ["anio"],
  ordenes_trabajo: ["kilometraje"],
  orden_notas: ["id"],
  orden_actividad: ["id"],
  orden_fotos: ["id"],
  cotizaciones: ["total", "pagada", "seguimiento"],
  cotizacion_items: ["id", "cantidad", "precioUnitario"],
};

function normalizarFila(tabla: NombreTablaRespaldo, fila: Record<string, unknown>): Record<string, unknown> {
  const nuleables = new Set(COLUMNAS_NULEABLES[tabla] ?? []);
  const numericas = new Set(COLUMNAS_NUMERICAS[tabla] ?? []);
  const resultado: Record<string, unknown> = {};
  for (const [columna, valorCrudo] of Object.entries(fila)) {
    const valor = String(valorCrudo ?? "");
    if (valor === "" && nuleables.has(columna)) {
      resultado[columna] = null;
    } else if (numericas.has(columna)) {
      resultado[columna] = Number(valor);
    } else {
      resultado[columna] = valor;
    }
  }
  return resultado;
}

async function main() {
  const rutaZip = process.argv[2];
  const confirmado = process.argv.includes("--confirmar");

  if (!rutaZip) {
    console.error("Uso: npx tsx scripts/restaurar-respaldo.ts <ruta-al-zip> --confirmar");
    process.exit(1);
  }
  if (!confirmado) {
    console.error(
      "Esta acción borra TODOS los datos actuales del taller y los reemplaza con los del respaldo.\n" +
        "Vuelva a ejecutar el comando agregando --confirmar si está seguro:\n" +
        `  npx tsx scripts/restaurar-respaldo.ts "${rutaZip}" --confirmar`
    );
    process.exit(1);
  }

  const buffer = fs.readFileSync(path.resolve(rutaZip));
  const zip = await JSZip.loadAsync(buffer);

  const datos: Partial<Record<NombreTablaRespaldo, Record<string, unknown>[]>> = {};

  for (const tabla of TABLAS) {
    const archivo = zip.file(`${tabla}.csv`);
    if (!archivo) {
      console.error(`El respaldo no contiene ${tabla}.csv — archivo inválido o incompleto.`);
      process.exit(1);
    }
    const contenido = await archivo.async("string");
    const { data, errors } = Papa.parse<Record<string, unknown>>(contenido, {
      header: true,
      skipEmptyLines: true,
    });
    if (errors.length > 0) {
      console.error(`Error al leer ${tabla}.csv:`, errors);
      process.exit(1);
    }
    datos[tabla] = data.map((fila) => normalizarFila(tabla, fila));
  }

  // orden_fotos rows may reference a photo file inside fotos/ instead of
  // carrying the original data: URL directly (see src/lib/backup/exportar.ts)
  // — reconstitute those back into data: URLs before restoring.
  const fotos = datos.orden_fotos ?? [];
  for (const fila of fotos) {
    const url = String(fila.url ?? "");
    if (!url.startsWith("fotos/")) continue;
    const archivoFoto = zip.file(url);
    if (!archivoFoto) {
      console.error(`El respaldo referencia ${url} pero el archivo no está en el zip.`);
      process.exit(1);
    }
    const base64 = await archivoFoto.async("base64");
    const extension = url.split(".").pop() ?? "png";
    const mime = extension === "jpg" ? "jpeg" : extension;
    fila.url = `data:image/${mime};base64,${base64}`;
  }

  console.log("Filas encontradas en el respaldo:");
  for (const tabla of TABLAS) {
    console.log(`  ${tabla}: ${datos[tabla]?.length ?? 0}`);
  }

  importarTablas(datos);
  console.log("\nRestauración completada.");
}

main().catch((error) => {
  console.error("FALLÓ LA RESTAURACIÓN (la base de datos no fue modificada):", error);
  process.exit(1);
});
