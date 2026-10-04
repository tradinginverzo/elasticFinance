"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes inserta un <script> que aplica el tema antes de pintar (evita un parpadeo).
// Ese script ya se ejecuta en el HTML que envía el servidor; en el navegador lo marcamos
// como no ejecutable para que React 19 no avise de "script tag while rendering".
const scriptProps =
  typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

// Modo claro/oscuro: sigue la configuración del sistema (iPhone o PC).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
