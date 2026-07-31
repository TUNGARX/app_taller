import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { RoleProvider } from "@/lib/role-context";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

// Bebas Neue: bold condensed signage font, used for headings and the wordmark.
const display = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// IBM Plex Sans: technical, legible body font for forms and copy.
const body = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// IBM Plex Mono: "diagnostic readout" font for plates, IDs, and figures.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Automotivo - Gestión de Taller",
  description: "Sistema de gestión para Automotivo — nuestro motivo sos vos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the .dark class before paint so there's no flash of the
            wrong theme — must run synchronously, before body renders. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-(--color-bg) text-(--color-ink) font-(family-name:--font-body)">
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
