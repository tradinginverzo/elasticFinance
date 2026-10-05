import "server-only";

import { cn } from "@/lib/utils";

// Etiqueta "DEV" para saber que la app apunta a la base de pruebas (Supabase elastic-finance-dev):
// en tu PC (npm run dev, .env.local) y en las vistas previas de Vercel.
// En producción no se muestra nada. VERCEL_ENV lo define Vercel automáticamente; en local no existe.
export function EnvBadge({ className }: { className?: string }) {
  if (process.env.VERCEL_ENV === "production") return null;

  return (
    <span
      title="Desarrollo: datos de prueba (Supabase elastic-finance-dev)"
      className={cn(
        "rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      DEV
    </span>
  );
}
