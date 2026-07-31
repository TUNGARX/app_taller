import type { Vehiculo } from "@/lib/types";

// Mock rows for the "Vehiculos" Google Sheet tab.
export const vehiculos: Vehiculo[] = [
  {
    id: "veh-001",
    clienteId: "cli-001",
    placa: "BPP123",
    marca: "Toyota",
    modelo: "Corolla",
    anio: 2018,
    color: "Gris",
  },
  {
    id: "veh-002",
    clienteId: "cli-002",
    placa: "CL456789",
    marca: "Hyundai",
    modelo: "Tucson",
    anio: 2021,
    color: "Blanco",
  },
  {
    id: "veh-003",
    clienteId: "cli-003",
    placa: "SJB234",
    marca: "Nissan",
    modelo: "Sentra",
    anio: 2016,
    color: "Rojo",
  },
  {
    id: "veh-004",
    clienteId: "cli-004",
    placa: "HB567890",
    marca: "Suzuki",
    modelo: "Grand Vitara",
    anio: 2019,
    color: "Negro",
  },
  {
    id: "veh-005",
    clienteId: "cli-005",
    placa: "CTG890",
    marca: "Kia",
    modelo: "Rio",
    anio: 2020,
    color: "Azul",
  },
  {
    id: "veh-006",
    clienteId: "cli-006",
    placa: "PUN345",
    marca: "Chevrolet",
    modelo: "Spark",
    anio: 2017,
    color: "Plateado",
  },
];
