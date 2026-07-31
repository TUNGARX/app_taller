import { IVA_TASA, type CotizacionItem } from "@/lib/types";

export interface LineaCalculada {
  item: CotizacionItem;
  subtotalNeto: number;
  iva: number;
  total: number;
}

export interface TotalesCotizacion {
  lineas: LineaCalculada[];
  totalManoDeObra: number; // neto, sin IVA — matches "Total mano de obra" on the reference quote
  totalRepuestos: number; // neto, sin IVA — matches "Total repuestos"
  subtotalNeto: number; // "Total Neto"
  iva: number; // "Total IVA"
  total: number; // "Total" — grand total, IVA included
}

/**
 * Computes the full Subtotal/IVA(13%)/Total breakdown for a quote's line
 * items, plus labor-vs-parts subtotals. `precioUnitario` on each item is
 * treated as the pre-tax (neto) unit price — this is the single place that
 * calculation happens, shared by the on-screen quote view and the PDF export.
 */
export function calcularTotalesCotizacion(items: CotizacionItem[]): TotalesCotizacion {
  const lineas: LineaCalculada[] = items.map((item) => {
    const subtotalNeto = item.cantidad * item.precioUnitario;
    const iva = subtotalNeto * IVA_TASA;
    return { item, subtotalNeto, iva, total: subtotalNeto + iva };
  });

  const subtotalNeto = lineas.reduce((sum, l) => sum + l.subtotalNeto, 0);
  const iva = lineas.reduce((sum, l) => sum + l.iva, 0);
  const totalManoDeObra = lineas
    .filter((l) => l.item.tipo === "Mano de Obra")
    .reduce((sum, l) => sum + l.subtotalNeto, 0);
  const totalRepuestos = lineas
    .filter((l) => l.item.tipo === "Repuesto")
    .reduce((sum, l) => sum + l.subtotalNeto, 0);

  return {
    lineas,
    totalManoDeObra,
    totalRepuestos,
    subtotalNeto,
    iva,
    total: subtotalNeto + iva,
  };
}
