"use client";

import { useState } from "react";
import type { Cliente, Cotizacion, OrdenTrabajo, Vehiculo } from "@/lib/types";

export default function DescargarCotizacionPdfButton({
  cotizacion,
  orden,
  vehiculo,
  cliente,
}: {
  cotizacion: Cotizacion;
  orden: OrdenTrabajo;
  vehiculo: Vehiculo;
  cliente: Cliente;
}) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    try {
      const [{ pdf }, { default: CotizacionPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./CotizacionPdfDocument"),
      ]);

      const documento = (
        <CotizacionPdfDocument
          cotizacion={cotizacion}
          orden={orden}
          vehiculo={vehiculo}
          cliente={cliente}
        />
      );
      const blob = await pdf(documento).toBlob();

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      const prefijo = cotizacion.estado === "Aprobada" && cotizacion.pagada ? "Factura" : "Orden";
      enlace.download = `${prefijo}-${vehiculo.placa}-${cotizacion.fecha}.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  const esFactura = cotizacion.estado === "Aprobada" && cotizacion.pagada;

  return (
    <div>
      <button
        type="button"
        onClick={descargar}
        disabled={generando}
        className="rounded-md border border-safety px-3 py-1.5 text-xs font-medium text-safety transition-colors hover:bg-safety hover:text-white disabled:opacity-50"
      >
        {generando ? "Generando PDF..." : `Descargar PDF (${esFactura ? "Factura" : "Orden"})`}
      </button>
      {error && <p className="mt-1 text-xs text-stage-repuestos">{error}</p>}
    </div>
  );
}
