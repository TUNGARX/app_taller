import { NextResponse } from "next/server";
import { clientes } from "@/lib/mock-db";

// Stub route handler backed by the mock DB. Will point at the real
// "Clientes" Google Sheet once the Sheets API integration is built.
export async function GET() {
  return NextResponse.json(clientes);
}
