import { NextResponse } from "next/server";
import { getHistorialVehiculo } from "@/lib/mock-db";
import { auth } from "@/auth";
import { ocultarCotizacionSiMecanico } from "@/lib/cotizacion-redaccion";

// Full service history for a vehicle, keyed by vehiculoId (i.e. by plate) so
// it stays intact across ownership changes. Used by the order detail modal —
// mechanics can see this even though they can't see quote prices, so each
// entry's cotización is stripped server-side for that role.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { vehiculo, ordenes } = getHistorialVehiculo(id);
  if (!vehiculo) {
    return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
  }

  const session = await auth();
  const rol = session?.user?.rol ?? null;
  const ordenesFiltradas = ordenes.map((entrada) => ocultarCotizacionSiMecanico(entrada, rol));

  return NextResponse.json({ vehiculo, ordenes: ordenesFiltradas });
}
