import { ChevronLeftIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Fichas de solo lectura (movimiento, cuenta, gasto fijo, producto): se ve todo sin riesgo de
// cambiar nada; para modificar hay que tocar "Editar".

export function DetailHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  editHref,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  editHref?: string;
  children?: React.ReactNode; // p. ej. el monto destacado
}) {
  return (
    <div className="flex flex-col gap-1">
      <Link href={backHref} className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {editHref && (
          <Button variant="outline" className="h-9 shrink-0" render={<Link href={editHref} />} nativeButton={false}>
            <PencilIcon />
            Editar
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

// Lista de datos "Etiqueta · valor". Las filas sin valor no se muestran.
export function DetailList({ rows }: { rows: { label: string; value: React.ReactNode; className?: string }[] }) {
  const visible = rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== "" && r.value !== false);
  return (
    <dl className="divide-y overflow-hidden rounded-xl border bg-card">
      {visible.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
          <dt className="shrink-0 text-sm text-muted-foreground">{r.label}</dt>
          <dd className={cn("min-w-0 text-right text-sm font-medium break-words", r.className)}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
