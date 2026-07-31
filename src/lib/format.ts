const colones = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

export function formatColones(amount: number): string {
  return colones.format(amount);
}

const colonesPdf = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});

/** Same as formatColones but renders "CRC 21,900" instead of "₡21,900" — the
 *  ₡ glyph isn't in the PDF's base Helvetica font and renders as garbage
 *  ("¡"), so PDF output must use the ASCII currency code instead. */
export function formatColonesPdf(amount: number): string {
  return colonesPdf.format(amount);
}

const fecha = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Formats an ISO date string ("2026-07-28") as "28 jul 2026". Avoids UTC/local
 *  timezone drift by parsing the parts directly instead of `new Date(iso)`. */
export function formatFecha(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return fecha.format(new Date(year, month - 1, day));
}

export function diasDesde(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const inicio = new Date(year, month - 1, day);
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((hoySinHora.getTime() - inicio.getTime()) / 86_400_000));
}

/** Hours elapsed since a delivery date + time (falls back to start-of-day if
 *  no hora is recorded). Used to auto-hide old "Entregado" cards. */
export function horasDesde(fechaIso: string, hora: string | null): number {
  const [year, month, day] = fechaIso.split("-").map(Number);
  const [horas, minutos] = (hora ?? "00:00").split(":").map(Number);
  const momento = new Date(year, month - 1, day, horas, minutos);
  return (Date.now() - momento.getTime()) / (1000 * 60 * 60);
}
