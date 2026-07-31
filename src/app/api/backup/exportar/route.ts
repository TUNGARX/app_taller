import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { generarRespaldoZip } from "@/lib/backup/exportar";

// Owner-only: downloads a ZIP with one CSV per business table (plus any
// uploaded evidence photos as real image files) so the shop owner can keep a
// copy in his own Google Drive as a backup.
export async function GET() {
  const check = await requireActor();
  if ("error" in check) return check.error;
  if (check.actor.rol !== "Owner") {
    return NextResponse.json({ error: "Solo el dueño puede descargar el respaldo." }, { status: 403 });
  }

  const zip = await generarRespaldoZip();
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="respaldo-automotivo-${fecha}.zip"`,
    },
  });
}
