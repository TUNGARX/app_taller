import Image from "next/image";
import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-steel text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center rounded-md bg-white px-2 py-1">
            <Image src="/logo.jpg" alt="Automotivo" width={897} height={545} className="h-7 w-auto" priority />
          </Link>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 sm:inline">
            Portal de Clientes
          </span>
        </div>
        <div className="hazard-strip h-1 w-full opacity-80" />
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
