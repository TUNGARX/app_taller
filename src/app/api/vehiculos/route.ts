import { NextResponse } from "next/server";
import { getClienteById, getHistorialVehiculo, getVehiculoByPlaca, listarVehiculos } from "@/lib/db/negocio";

// Supports ?placa= for the public portal lookup, returning the vehicle plus
// its owner and full service history.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placa = searchParams.get("placa");

  if (placa) {
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

  return NextResponse.json(listarVehiculos());
}
