import { NextResponse } from "next/server";
import { listarClientes } from "@/lib/db/negocio";

export async function GET() {
  return NextResponse.json(listarClientes());
}
