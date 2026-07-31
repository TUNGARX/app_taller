"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "taller-theme";

/** Sun/moon toggle for light/dark mode. Styled to match the existing header
 *  icon buttons (StaffNav's hamburger, etc.) since every current placement
 *  sits on the app's dark "steel" header bar. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  // null until mounted — avoids assuming a theme before we can read the
  // class the FOUC-prevention script already set on <html>.
  const [oscuro, setOscuro] = useState<boolean | null>(null);

  useEffect(() => {
    // Reading the class the FOUC-prevention script already set on <html>
    // must happen after mount (SSR has no DOM) — the state update can't be
    // avoided here, same pattern as role-context.tsx's hydration read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const nuevoOscuro = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nuevoOscuro);
    localStorage.setItem(THEME_KEY, nuevoOscuro ? "dark" : "light");
    setOscuro(nuevoOscuro);
  }

  if (oscuro === null) {
    return <span className={`inline-block h-9 w-9 ${className}`} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      className={`flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 ${className}`}
    >
      {oscuro ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          />
        </svg>
      )}
    </button>
  );
}
