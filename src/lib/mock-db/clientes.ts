import type { Cliente } from "@/lib/types";

// Mock rows for the "Clientes" Google Sheet tab.
export const clientes: Cliente[] = [
  {
    id: "cli-001",
    nombre: "Marco Vargas Solís",
    telefono: "8888-1234",
    email: "marco.vargas@example.com",
    direccion: "San José, Curridabat, 200m sur del CENADA",
  },
  {
    id: "cli-002",
    nombre: "Ana Lucía Rojas Mora",
    telefono: "8712-5566",
    email: "ana.rojas@example.com",
    direccion: "Heredia, San Rafael, Residencial Los Ángeles",
  },
  {
    id: "cli-003",
    nombre: "Carlos Andrés Jiménez",
    telefono: "6050-9988",
    email: "carlos.jimenez@example.com",
    direccion: "Alajuela, La Guácima, calle Las Palmas",
  },
  {
    id: "cli-004",
    nombre: "Kimberly Castro Araya",
    telefono: "8399-4477",
    email: "kimberly.castro@example.com",
    direccion: "Cartago, Paraíso, frente a la iglesia",
  },
  {
    id: "cli-005",
    nombre: "Luis Fernando Quesada",
    telefono: "8654-2211",
    email: "luis.quesada@example.com",
    direccion: "San José, Desamparados, San Rafael Abajo",
  },
  {
    id: "cli-006",
    nombre: "Gabriela Méndez Chinchilla",
    telefono: "7070-3344",
    email: "gabriela.mendez@example.com",
    direccion: "Puntarenas, Esparza, Barrio San José",
  },
];
