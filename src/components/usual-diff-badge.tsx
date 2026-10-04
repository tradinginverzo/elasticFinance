import { formatAmount } from "@/lib/money";
import { compareToUsual } from "@/lib/usual-diff";
import { cn } from "@/lib/utils";

// En la etiqueta solo el número ("6,50"); la moneda ya está en el monto de al lado.
const BADGE_NUMBER = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const TONE_CLASSES = {
  worse: "bg-expense/10 text-expense",
  better: "bg-income/10 text-income",
} as const;

// Etiqueta compacta "+6,50" / "−10,00" cuando un movimiento de un gasto fijo no coincide con su
// monto habitual. Rojo = peor para el bolsillo, verde = mejor. Nada si coincide.
export function UsualDiffBadge({
  type,
  amountCents,
  usualCents,
  currency,
  className,
}: {
  type: "EXPENSE" | "INCOME";
  amountCents: number;
  usualCents: number | null | undefined;
  currency: string;
  className?: string;
}) {
  const diff = compareToUsual(type, amountCents, usualCents);
  if (!diff) return null;

  return (
    <span
      title={`Habitual: ${formatAmount(usualCents!, currency)}`}
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums",
        TONE_CLASSES[diff.tone],
        className,
      )}
    >
      {diff.delta > 0 ? "+" : "−"}
      {BADGE_NUMBER.format(Math.abs(diff.delta) / 100)}
      <span className="sr-only"> respecto a lo habitual</span>
    </span>
  );
}

// Nota completa para el formulario: "6,50 US$ más que lo habitual (45,50 US$) · +14 %".
export function UsualDiffNote({
  type,
  amountCents,
  usualCents,
  currency,
  name,
}: {
  type: "EXPENSE" | "INCOME";
  amountCents: number | null;
  usualCents: number;
  currency: string;
  name: string;
}) {
  const fmt = (cents: number) => formatAmount(cents, currency);
  const diff = amountCents === null ? null : compareToUsual(type, amountCents, usualCents);

  if (!diff) {
    return (
      <p className="text-xs text-muted-foreground">
        Monto habitual de {name}: {fmt(usualCents)}. Cámbialo si este mes fue distinto.
      </p>
    );
  }

  return (
    <p className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium", TONE_CLASSES[diff.tone])}>
      {fmt(Math.abs(diff.delta))} {diff.delta > 0 ? "más" : "menos"} que lo habitual ({fmt(usualCents)})
      {diff.percent !== null && ` · ${diff.percent > 0 ? "+" : "−"}${Math.abs(diff.percent)} %`}
    </p>
  );
}
