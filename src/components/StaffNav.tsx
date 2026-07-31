"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ROLE_LABEL, nombreMostrado, useRole } from "@/lib/role-context";
import type { Rol } from "@/lib/types";

const links: { href: string; label: string; roles: Rol[] }[] = [
  { href: "/dashboard", label: "Panel", roles: ["Owner", "Secretary", "Mechanic"] },
  { href: "/citas", label: "Agendar Cita", roles: ["Owner", "Secretary"] },
  { href: "/staff", label: "Personal", roles: ["Owner"] },
];

export default function StaffNav() {
  const { rol, nombre, cerrarSesion } = useRole();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const linksVisibles = links.filter((link) => !rol || link.roles.includes(rol));

  return (
    <header className="sticky top-0 z-20 bg-steel text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" onClick={() => setMenuAbierto(false)}>
          <span className="flex items-center rounded-md bg-white px-2 py-1">
            <Image src="/logo.jpg" alt="Automotivo" width={897} height={545} className="h-7 w-auto" priority />
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 sm:inline">
            Gestión de Órdenes
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {linksVisibles.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          {rol && (
            <button
              type="button"
              onClick={() => cerrarSesion()}
              className="ml-2 flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-safety hover:text-white"
            >
              <span className="font-mono uppercase tracking-wide">
                {nombreMostrado(nombre, rol)} · {ROLE_LABEL[rol]}
              </span>
              <span className="text-white/40">· Cambiar</span>
            </button>
          )}
        </nav>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          onClick={() => setMenuAbierto((prev) => !prev)}
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuAbierto}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 sm:hidden"
        >
          {menuAbierto ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuAbierto && (
        <nav className="animate-rise-in flex flex-col gap-1 border-t border-white/10 px-4 pb-4 pt-2 sm:hidden">
          {linksVisibles.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuAbierto(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          {rol && (
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                cerrarSesion();
              }}
              className="mt-2 flex items-center justify-between rounded-md border border-white/15 px-3 py-2.5 text-xs font-medium text-white/70 transition-colors hover:border-safety hover:text-white"
            >
              <span className="font-mono uppercase tracking-wide">
                {nombreMostrado(nombre, rol)} · {ROLE_LABEL[rol]}
              </span>
              <span className="text-white/40">Cambiar</span>
            </button>
          )}
        </nav>
      )}

      <div className="hazard-strip h-1 w-full opacity-80" />
    </header>
  );
}
