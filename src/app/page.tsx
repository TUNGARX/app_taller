import Image from "next/image";
import Link from "next/link";
import { listarCitas, listarOrdenes } from "@/lib/db/negocio";
import IngresoPanel from "@/components/IngresoPanel";
import ThemeToggle from "@/components/ThemeToggle";

// Reads live DB data on every render (citas/órdenes stat counts) — without
// this, Next.js has no signal to avoid statically prerendering the page at
// build time, which would freeze these numbers forever until the next deploy.
export const dynamic = "force-dynamic";

export default function Home() {
  const hoy = new Date().toISOString().slice(0, 10);
  const citas = listarCitas();
  const ordenesTrabajo = listarOrdenes();
  const citasHoy = citas.filter((c) => c.fecha === hoy && c.estado !== "Cancelada").length;
  const activas = ordenesTrabajo.filter((o) => o.estadoKanban !== "Entregado").length;
  const listas = ordenesTrabajo.filter((o) => o.estadoKanban === "Entregado").length;

  return (
    <div className="relative flex flex-1 flex-col bg-steel text-white">
      <div className="hazard-strip h-1.5 w-full" />
      <ThemeToggle className="absolute right-4 top-5 sm:right-6" />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="animate-rise-in font-mono text-xs uppercase tracking-[0.35em] text-white/40">
          Sistema de Gestión de Taller
        </p>
        <div className="animate-rise-in mt-4 rounded-xl bg-white px-6 py-4 sm:px-8 sm:py-5">
          <Image
            src="/logo.jpg"
            alt="Automotivo — Nuestro motivo sos vos"
            width={897}
            height={545}
            className="h-16 w-auto sm:h-20"
            priority
          />
        </div>
        <p className="animate-rise-in mt-4 max-w-md text-white/60">
          Del diagnóstico a la entrega — cada orden de trabajo bajo control.
        </p>

        <div className="animate-rise-in mt-10 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-display text-4xl text-safety">{activas}</p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              En Proceso
            </p>
          </div>
          <div>
            <p className="font-display text-4xl text-amber">{citasHoy}</p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              Citas Hoy
            </p>
          </div>
          <div>
            <p className="font-display text-4xl text-stage-entregado">{listas}</p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              Entregadas
            </p>
          </div>
        </div>

        <p className="animate-rise-in mt-12 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
          Ingresar
        </p>
        <div className="animate-rise-in mt-3 flex justify-center">
          <IngresoPanel />
        </div>

        <div className="animate-rise-in mt-10 border-t border-white/10 pt-6">
          <Link href="/buscar" className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline">
            Soy cliente — consultar el estado de mi vehículo
          </Link>
        </div>
      </div>
    </div>
  );
}
