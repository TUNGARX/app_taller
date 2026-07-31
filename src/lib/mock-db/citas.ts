import type { Cita } from "@/lib/types";

// Mock rows for the "Citas" Google Sheet tab.
export const citas: Cita[] = [
  {
    id: "cit-001",
    clienteId: "cli-001",
    vehiculoId: "veh-001",
    fecha: "2026-07-25",
    hora: "08:30",
    motivo: "Ruido en frenos delanteros",
    estado: "Completada",
  },
  {
    id: "cit-002",
    clienteId: "cli-002",
    vehiculoId: "veh-002",
    fecha: "2026-07-27",
    hora: "10:00",
    motivo: "Cambio de aceite y filtros",
    estado: "Completada",
  },
  {
    id: "cit-003",
    clienteId: "cli-003",
    vehiculoId: "veh-003",
    fecha: "2026-07-28",
    hora: "13:15",
    motivo: "Revisión de aire acondicionado",
    estado: "Confirmada",
  },
  {
    id: "cit-004",
    clienteId: "cli-004",
    vehiculoId: "veh-004",
    fecha: "2026-07-29",
    hora: "09:00",
    motivo: "Diagnóstico de luz de check engine",
    estado: "Programada",
  },
  {
    id: "cit-005",
    clienteId: "cli-005",
    vehiculoId: "veh-005",
    fecha: "2026-07-30",
    hora: "14:30",
    motivo: "Cambio de banda de tiempo",
    estado: "Programada",
  },
  {
    id: "cit-006",
    clienteId: "cli-006",
    vehiculoId: "veh-006",
    fecha: "2026-07-22",
    hora: "11:00",
    motivo: "Revisión previa a viaje largo",
    estado: "Cancelada",
  },
];
