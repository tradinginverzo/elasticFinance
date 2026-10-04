import "server-only";

import { cn } from "@/lib/utils";

// Indica a qué entorno (y por tanto a qué base de Supabase) apunta la app:
// - PRO: publicada en Vercel producción → proyecto "elastic-finance" (datos reales).
// - DEV: tu PC (npm run dev, .env.local) o una vista previa de Vercel → proyecto de pruebas.
// VERCEL_ENV lo define Vercel automáticamente; en local no existe.
export function EnvBadge({ className }: { className?: string }) {
  const isProduction = process.env.VERCEL_ENV === "production";

  return (
    <span
      title={
        isProduction
          ? "Producción: datos reales (Supabase elastic-finance)"
          : "Desarrollo: datos de prueba (Supabase elastic-finance-dev)"
      }
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wider",
        isProduction
          ? "bg-primary/15 text-primary"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {isProduction ? "PRO" : "DEV"}
    </span>
  );
}
