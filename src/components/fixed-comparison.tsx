import { formatAmount } from "@/lib/money";

// Ingresos fijos vs. gastos fijos: qué parte de los ingresos fijos se llevan los gastos fijos
// y cuánto queda libre. Barra de una sola medida (parte del total), no un gráfico.
// Montos en centavos (number). Se usa en el listado de gastos fijos y en el simulador.
export function FixedComparison({
  income,
  expense,
  currency,
}: {
  income: number;
  expense: number;
  currency: string;
}) {
  if (income === 0 && expense === 0) return null;

  const fmt = (cents: number) => formatAmount(cents, currency);
  const free = income - expense;
  const share = income > 0 ? expense / income : null;
  const expenseWidth = income > 0 ? Math.min(expense / income, 1) * 100 : 100;

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Fijos: ingresos vs. gastos</span>
        <span className="font-medium tabular-nums">
          {share === null ? "—" : `${Math.round(share * 100)} %`}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Parte de los ingresos fijos que se llevan los gastos fijos"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share === null ? 100 : Math.round(share * 100)}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {expense > 0 && (
          <div className="h-full rounded-full bg-expense" style={{ width: `${expenseWidth}%` }} />
        )}
        {free > 0 && <div className="h-full flex-1 rounded-full bg-income" />}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-expense" aria-hidden />
          <span className="text-muted-foreground">Gastos fijos</span>
          <span className="font-medium tabular-nums">{fmt(expense)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-income" aria-hidden />
          <span className="text-muted-foreground">Ingresos fijos</span>
          <span className="font-medium tabular-nums">{fmt(income)}</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {income === 0
          ? "Aún no tienes ingresos fijos guardados (por ejemplo tu sueldo)."
          : free >= 0
            ? `Tus gastos fijos se llevan el ${Math.round(share! * 100)} % de tus ingresos fijos. Te quedan ${fmt(free)} para lo demás.`
            : `Tus gastos fijos superan tus ingresos fijos en ${fmt(-free)} cada mes.`}
      </p>
    </div>
  );
}
