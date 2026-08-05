"use client";

import { useState } from "react";

/** Password `<input>` with a show/hide eye-icon toggle — shared by the
 *  sign-in form, the forced/self-service password-change screen, and the
 *  recovery-code password reset, so the toggle behavior/icons never drift
 *  between them. */
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  className = "",
  iconClassName = "text-ink/40 hover:text-ink",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="relative">
      <input
        type={mostrar ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setMostrar((prev) => !prev)}
        aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${iconClassName}`}
      >
        {mostrar ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.9 9.9 0 0112 4c5 0 9.27 3.11 11 7.5a13.5 13.5 0 01-2.16 3.19M6.6 6.6C4.6 7.9 3.02 9.9 2 11.5 3.73 15.89 8 19 12 19a9.9 9.9 0 004.24-.94" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 11.5C3.73 7.11 8 4 12 4s8.27 3.11 10 7.5C20.27 15.89 16 19 12 19s-8.27-3.11-10-7.5z" />
            <circle cx="12" cy="11.5" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
