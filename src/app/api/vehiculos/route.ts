import { NextResponse } from "next/server";
import { getClienteById, getHistorialVehiculo, getVehiculoByPlaca, vehiculos } from "@/lib/mock-db";

// Stub route handler backed by the mock DB. Supports ?placa= for the public
// portal lookup, returning the vehicle plus its owner and full service history.
// Will point at the real "Vehiculos" Google Sheet later.
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

  return NextResponse.json(vehiculos);
}
