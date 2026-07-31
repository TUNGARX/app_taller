import Papa from "papaparse";
import JSZip from "jszip";
import { exportarTablas } from "@/lib/db/negocio";

/** Guesses a file extension from a `data:image/...;base64,` URL — falls
 *  back to "bin" for anything unexpected rather than throwing. */
function extensionDeDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);base64,/.exec(dataUrl);
  if (!match) return "bin";
  return match[1] === "jpeg" ? "jpg" : match[1];
}

/**
 * Builds a ZIP backup of every business table: one CSV per table, plus a
 * `fotos/` folder holding any evidence photo that was uploaded as a base64
 * `data:` URL — those are decoded back into real image files instead of
 * being dumped into a CSV cell (which would both bloat the file and risk
 * hitting spreadsheet-app cell size limits). Seed/placeholder photo URLs
 * (plain https://... links) stay as ordinary CSV text.
 *
 * Never includes the `users` table — a spreadsheet backup meant to live in
 * someone's Google Drive is not where password hashes should end up.
 */
export async function generarRespaldoZip(): Promise<Buffer> {
  const tablas = exportarTablas();
  const zip = new JSZip();

  for (const [nombre, filas] of Object.entries(tablas)) {
    if (nombre === "orden_fotos") {
      const filasParaCsv = filas.map((fila, indice) => {
        const url = String(fila.url ?? "");
        if (!url.startsWith("data:")) return fila;

        const base64 = url.split(",")[1] ?? "";
        const extension = extensionDeDataUrl(url);
        const nombreArchivo = `${fila.ordenId}-${indice}.${extension}`;
        zip.file(`fotos/${nombreArchivo}`, base64, { base64: true });
        return { ...fila, url: `fotos/${nombreArchivo}` };
      });
      zip.file(`${nombre}.csv`, Papa.unparse(filasParaCsv));
    } else {
      zip.file(`${nombre}.csv`, Papa.unparse(filas));
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
