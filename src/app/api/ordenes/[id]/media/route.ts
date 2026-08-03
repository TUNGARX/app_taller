import { NextResponse } from "next/server";
import { agregarMediaOrden, getOrdenById, getVehiculoById } from "@/lib/db/negocio";
import { requireActor } from "@/lib/auth/getActorFromSession";
import { subirArchivoPlaca } from "@/lib/google/drive";
import { googleConfigurado } from "@/lib/google/client";
import type { TipoMedia } from "@/lib/types";

// POST a multipart/form-data body with a "file" field (photo or video) to
// upload evidence into the vehicle's Google Drive folder (named after its
// plate, under the shared "Automotivo" root — see src/lib/google/drive.ts).
// Only the Drive file id + links are stored in SQLite. Superseded the old
// /fotos route, which stored full base64 data: URLs directly in the DB —
// fine for a couple of photos, not viable once videos are involved.
const TAMANO_MAXIMO_BYTES = 50 * 1024 * 1024; // 50MB — generous for phone photos/short clips

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireActor();
  if ("error" in check) return check.error;

  if (!googleConfigurado()) {
    return NextResponse.json(
      { error: "La integración con Google Drive todavía no está configurada en este servidor." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const orden = getOrdenById(id);
  if (!orden) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  if (orden.estadoKanban === "Entregado") {
    return NextResponse.json(
      { error: "No se puede agregar evidencia a una orden ya entregada." },
      { status: 400 }
    );
  }

  const vehiculo = getVehiculoById(orden.vehiculoId);
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debe adjuntar un archivo." }, { status: 400 });
  }
  if (file.size > TAMANO_MAXIMO_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el tamaño máximo permitido (50MB)." },
      { status: 400 }
    );
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Solo se permiten fotos o videos." }, { status: 400 });
  }

  const tipo: TipoMedia = file.type.startsWith("video/") ? "video" : "foto";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const subida = await subirArchivoPlaca(vehiculo.placa, buffer, file.name, file.type);
    const ordenActualizada = agregarMediaOrden(
      id,
      {
        tipo,
        driveFileId: subida.id,
        url: subida.webViewLink,
        thumbnailUrl: subida.thumbnailLink,
        mimeType: subida.mimeType,
        nombre: file.name,
      },
      check.actor
    );
    return NextResponse.json(ordenActualizada);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir el archivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
