"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Modo claro/oscuro: sigue la configuración del sistema (iPhone o PC).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
