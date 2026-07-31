import { getCitasConDetalle, getClienteById, listarVehiculos } from "@/lib/db/negocio";
import CitaScheduler from "@/components/citas/CitaScheduler";
import RoleGuard from "@/components/RoleGuard";

export default function CitasPage() {
  const vehiculosConCliente = listarVehiculos().map((vehiculo) => ({
    vehiculo,
    clienteNombre: getClienteById(vehiculo.clienteId)?.nombre ?? "Desconocido",
  }));

  const citasIniciales = getCitasConDetalle();

  return (
    <RoleGuard allow={["Owner", "Secretary"]}>
      <div className="flex-1 bg-bg px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-4xl tracking-wide text-ink">Agendar Cita</h1>
          <p className="mt-1 text-sm text-ink/60">
            Programe una cita para un cliente existente o registre un vehículo nuevo en el mismo paso.
          </p>

          <div className="mt-8">
            <CitaScheduler
              vehiculosConCliente={vehiculosConCliente}
              citasIniciales={citasIniciales}
            />
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
