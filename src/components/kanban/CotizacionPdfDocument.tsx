import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { calcularTotalesCotizacion } from "@/lib/cotizacion-calc";
import { formatColonesPdf, formatFecha } from "@/lib/format";
import { TALLER_CONFIG } from "@/lib/taller-config";
import type { Cliente, Cotizacion, OrdenTrabajo, Vehiculo } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#171412" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  presupuestoTitulo: { fontSize: 14, fontWeight: 700 },
  fecha: { fontSize: 8, fontStyle: "italic", marginTop: 2 },
  tallerNombre: { fontSize: 11, fontWeight: 700, marginTop: 6 },
  tallerEslogan: { fontSize: 9, fontWeight: 700 },
  tallerLinea: { fontSize: 8, marginTop: 2, color: "#444" },
  seccion: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  columna: { width: "48%" },
  etiqueta: { fontSize: 9, fontWeight: 700, marginBottom: 4 },
  campo: { fontSize: 9, marginBottom: 2 },
  tabla: { marginTop: 16, borderTop: "1pt solid #ccc" },
  filaEncabezado: {
    flexDirection: "row",
    borderBottom: "1pt solid #999",
    paddingVertical: 4,
    fontWeight: 700,
  },
  fila: { flexDirection: "row", borderBottom: "0.5pt solid #ddd", paddingVertical: 4 },
  colDetalle: { width: "34%" },
  colCant: { width: "9%", textAlign: "center" },
  colPUni: { width: "16%", textAlign: "right" },
  colDesc: { width: "9%", textAlign: "center" },
  colSubtotal: { width: "16%", textAlign: "right" },
  colIva: { width: "8%", textAlign: "center" },
  colTotal: { width: "16%", textAlign: "right" },
  totalesFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "0.5pt solid #ddd",
    paddingVertical: 4,
  },
  totalesFilaFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    fontWeight: 700,
    fontSize: 10,
  },
  firmas: { flexDirection: "row", justifyContent: "space-between", marginTop: 60 },
  firmaLinea: { fontSize: 9 },
});

export default function CotizacionPdfDocument({
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
  const { lineas, totalManoDeObra, totalRepuestos, subtotalNeto, iva, total } =
    calcularTotalesCotizacion(cotizacion.items);

  const numero = `0001-${cotizacion.id.replace(/\D/g, "").padStart(8, "0")}`;
  // A quote reads "Orden" until it's both approved and paid, at which point
  // it becomes the "Factura" — same document, same number, evolving title.
  const esFactura = cotizacion.estado === "Aprobada" && cotizacion.pagada;
  const tituloDocumento = esFactura ? "Factura" : "Orden";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.presupuestoTitulo}>
              {tituloDocumento} N° {numero}
            </Text>
            <Text style={styles.fecha}>Fecha: {cotizacion.fecha}</Text>
            <Text style={styles.tallerNombre}>{TALLER_CONFIG.nombre}</Text>
            <Text style={styles.tallerEslogan}>{TALLER_CONFIG.eslogan}</Text>
            <Text style={styles.tallerLinea}>
              Tel: {TALLER_CONFIG.telefono} | WhatsApp: {TALLER_CONFIG.whatsapp} | {TALLER_CONFIG.email}
            </Text>
            <Text style={styles.tallerLinea}>
              {TALLER_CONFIG.horario} | {TALLER_CONFIG.direccion}
            </Text>
          </View>
        </View>

        <View style={styles.seccion}>
          <View style={styles.columna}>
            <Text style={styles.etiqueta}>Datos del cliente:</Text>
            <Text style={styles.campo}>Nombre: {cliente.nombre}</Text>
            <Text style={styles.campo}>Teléfono: {cliente.telefono}</Text>
          </View>
          <View style={styles.columna}>
            <Text style={styles.etiqueta}>Datos del Vehículo:</Text>
            <Text style={styles.campo}>Placa: {vehiculo.placa}</Text>
            <Text style={styles.campo}>Marca: {vehiculo.marca}</Text>
            <Text style={styles.campo}>Modelo: {vehiculo.modelo}</Text>
            <Text style={styles.campo}>
              Año: {vehiculo.anio} · Color: {vehiculo.color}
            </Text>
            <Text style={styles.campo}>Kilometraje: {orden.kilometraje ?? "—"}</Text>
            <Text style={styles.campo}>Combustible: {orden.combustible ?? "—"}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.campo}>Concepto: {orden.tipoOrden.toUpperCase()}</Text>
          <Text style={styles.campo}>
            Entrada: {orden.horaIngreso ?? "—"} · Salida: {orden.horaSalida ?? "—"}
          </Text>
          <Text style={styles.campo}>Observaciones: {orden.diagnostico || "—"}</Text>
        </View>

        <View style={styles.tabla}>
          <View style={styles.filaEncabezado}>
            <Text style={styles.colDetalle}>Detalle</Text>
            <Text style={styles.colCant}>Cant.</Text>
            <Text style={styles.colPUni}>PUni.</Text>
            <Text style={styles.colDesc}>Desc.</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
            <Text style={styles.colIva}>IVA</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {lineas.map((linea, i) => (
            <View style={styles.fila} key={i}>
              <Text style={styles.colDetalle}>{linea.item.descripcion}</Text>
              <Text style={styles.colCant}>{linea.item.cantidad}</Text>
              <Text style={styles.colPUni}>{formatColonesPdf(linea.item.precioUnitario)}</Text>
              <Text style={styles.colDesc}>0%</Text>
              <Text style={styles.colSubtotal}>{formatColonesPdf(linea.subtotalNeto)}</Text>
              <Text style={styles.colIva}>13%</Text>
              <Text style={styles.colTotal}>{formatColonesPdf(linea.total)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 4 }}>
          <View style={styles.totalesFila}>
            <Text>Total mano de obra</Text>
            <Text>{formatColonesPdf(totalManoDeObra)}</Text>
          </View>
          <View style={styles.totalesFila}>
            <Text>Total repuestos</Text>
            <Text>{formatColonesPdf(totalRepuestos)}</Text>
          </View>
          <View style={styles.totalesFila}>
            <Text>Total Neto</Text>
            <Text>{formatColonesPdf(subtotalNeto)}</Text>
          </View>
          <View style={styles.totalesFila}>
            <Text>Total IVA</Text>
            <Text>{formatColonesPdf(iva)}</Text>
          </View>
          <View style={styles.totalesFilaFinal}>
            <Text>Total</Text>
            <Text>{formatColonesPdf(total)}</Text>
          </View>
        </View>

        <View style={styles.firmas}>
          <Text style={styles.firmaLinea}>Firma ............................................</Text>
          <Text style={styles.firmaLinea}>Aclaración .......................................</Text>
        </View>

        <Text style={{ marginTop: 20, fontSize: 7, color: "#888" }}>
          Generado {formatFecha(new Date().toISOString().slice(0, 10))} · Válido por 8 días.
        </Text>
      </Page>
    </Document>
  );
}
