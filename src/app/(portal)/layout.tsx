import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-steel text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="font-display text-2xl tracking-wide text-white">
            TALLER<span className="text-safety">.</span>
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
