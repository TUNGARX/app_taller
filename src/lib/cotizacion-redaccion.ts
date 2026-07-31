import type { Rol } from "@/lib/types";

/**
 * Mechanics must never see quote prices — this already holds in the UI
 * (RoleGuard/`puedeVerPrecios` hides the whole cotización block for them),
 * but that alone doesn't stop a Mechanic-role session from reading the same
 * data straight out of a raw API response or the dashboard's initial page
 * payload. This enforces the same "hide it entirely" rule server-side, so
 * the money data never leaves the server for that role in the first place.
 */
export function ocultarCotizacionSiMecanico<T extends { cotizacion?: unknown }>(
  detalle: T,
  rol: Rol | null
): T {
  if (rol !== "Mechanic") return detalle;
  return { ...detalle, cotizacion: undefined };
}
