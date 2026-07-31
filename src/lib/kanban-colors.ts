import type { EstadoKanban } from "@/lib/types";

// Single source of truth for the per-stage signal colors used across the
// Kanban board and the public status lookup, so both stay visually consistent.
export const STAGE_BORDER: Record<EstadoKanban, string> = {
  Ingresado: "border-l-stage-ingresado",
  "En Revisión": "border-l-stage-revision",
  "En Cotización": "border-l-stage-cotizacion",
  "Esperando Repuestos": "border-l-stage-repuestos",
  "En Reparación": "border-l-stage-reparacion",
  Terminado: "border-l-stage-terminado",
  "En Pruebas": "border-l-stage-pruebas",
  Entregado: "border-l-stage-entregado",
};

export const STAGE_BG: Record<EstadoKanban, string> = {
  Ingresado: "bg-stage-ingresado",
  "En Revisión": "bg-stage-revision",
  "En Cotización": "bg-stage-cotizacion",
  "Esperando Repuestos": "bg-stage-repuestos",
  "En Reparación": "bg-stage-reparacion",
  Terminado: "bg-stage-terminado",
  "En Pruebas": "bg-stage-pruebas",
  Entregado: "bg-stage-entregado",
};
