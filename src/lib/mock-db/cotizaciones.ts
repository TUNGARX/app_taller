import type { Cotizacion } from "@/lib/types";

// Mock rows for the "Cotizaciones" Google Sheet tab. Amounts are in colones
// (CRC). `precioUnitario` is the pre-tax (neto) unit price; `total` is the
// final grand total with 13% IVA included (see src/lib/cotizacion-calc.ts).
export const cotizaciones: Cotizacion[] = [
  {
    id: "cot-001",
    ordenId: "ord-001",
    items: [
      { descripcion: "Pastillas de freno delanteras", cantidad: 1, precioUnitario: 45000, tipo: "Repuesto" },
      { descripcion: "Discos de freno delanteros", cantidad: 2, precioUnitario: 38000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 25000, tipo: "Mano de Obra" },
    ],
    total: 164980,
    estado: "Aprobada",
    pagada: true,
    seguimiento: false,
    fechaSeguimiento: null,
    fecha: "2026-07-25",
  },
  {
    id: "cot-002",
    ordenId: "ord-002",
    items: [
      { descripcion: "Aceite sintético 5W-30 (4L)", cantidad: 1, precioUnitario: 32000, tipo: "Repuesto" },
      { descripcion: "Filtro de aceite", cantidad: 1, precioUnitario: 8000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 10000, tipo: "Mano de Obra" },
    ],
    total: 56500,
    estado: "Aprobada",
    pagada: true,
    seguimiento: false,
    fechaSeguimiento: null,
    fecha: "2026-07-27",
  },
  {
    id: "cot-003",
    ordenId: "ord-004",
    items: [
      { descripcion: "Sensor de oxígeno original", cantidad: 1, precioUnitario: 65000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 15000, tipo: "Mano de Obra" },
    ],
    total: 90400,
    estado: "Rechazada",
    pagada: false,
    seguimiento: true,
    fechaSeguimiento: "2026-08-01",
    fecha: "2026-07-29",
  },
  {
    id: "cot-004",
    ordenId: "ord-005",
    items: [
      { descripcion: "Banda de tiempo (kit completo)", cantidad: 1, precioUnitario: 95000, tipo: "Repuesto" },
      { descripcion: "Bomba de agua", cantidad: 1, precioUnitario: 40000, tipo: "Repuesto" },
      { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 60000, tipo: "Mano de Obra" },
    ],
    total: 220350,
    estado: "Aprobada",
    pagada: false,
    seguimiento: false,
    fechaSeguimiento: null,
    fecha: "2026-07-30",
  },
];
