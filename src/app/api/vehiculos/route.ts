import { NextResponse } from "next/server";
import { getClienteById, getHistorialVehiculo, getVehiculoByPlaca } from "@/lib/db/negocio";

// Public route (see middleware.ts PUBLIC_PATHS) — only supports the ?placa=
// lookup used by the public portal. Never falls back to listing every
// vehicle: this route has no session check, so an unfiltered list would leak
// the shop's full fleet/customer data to anyone.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placa = searchParams.get("placa");

  if (!placa) {
    return NextResponse.json(
      { error: "Debe indicar una placa." },
      { status: 400 }
    );
  }

  const vehiculo = getVehiculoByPlaca(placa);
  if (!vehiculo) {
    return NextResponse.json(
      { error: "No se encontró un vehículo con esa placa." },
      { status: 404 }
    );
  }
  const { ordenes } = getHistorialVehiculo(vehiculo.id);
  return NextResponse.json({
    vehiculo,
    cliente: getClienteById(vehiculo.clienteId),
    ordenes,
  });
}
