import { formatAmount } from "@/lib/money";

// Textos según qué se compara: los gastos/ingresos fijos, o los movimientos de un mes.
const COPY = {
  fixed: {
    title: "Fijos: ingresos vs. gastos",
    income: "Ingresos fijos",
    expense: "Gastos fijos",
    share: (pct: number, free: string) =>
      `Tus gastos fijos se llevan el ${pct} % de tus ingresos fijos. Te quedan ${free} para lo demás.`,
    over: (amount: string) => `Tus gastos fijos superan tus ingresos fijos en ${amount} cada mes.`,
    noIncome: "Aún no tienes ingresos fijos guardados (por ejemplo tu sueldo).",
  },
  month: {
    title: "Ingresos vs. gastos del mes",
    income: "Ingresos",
    expense: "Gastos",
    share: (pct: number, free: string) =>
      `Este mes has gastado el ${pct} % de lo que has ingresado. Te quedan ${free}.`,
    over: (amount: string) => `Este mes llevas ${amount} más de gastos que de ingresos.`,
    noIncome: "Aún no hay ingresos registrados este mes.",
  },
} as const;

// Ingresos vs. gastos: qué parte de los ingresos se llevan los gastos y cuánto queda libre.
// Barra de una sola medida (parte del total), no un gráfico. Montos en centavos (number).
// Se usa en el listado de gastos fijos, el simulador ("fixed") y en Movimientos ("month").
export function FixedComparison({
  income,
  expense,
  currency,
  simulated = false,
  variant = "fixed",
}: {
  income: number;
  expense: number;
  currency: string;
  simulated?: boolean; // los montos ya incluyen un cambio simulado (se indica en el título)
  variant?: keyof typeof COPY;
}) {
  if (income === 0 && expense === 0) return null;

  const copy = COPY[variant];
  const fmt = (cents: number) => formatAmount(cents, currency);
  const free = income - expense;
  const share = income > 0 ? expense / income : null;
  const expenseWidth = income > 0 ? Math.min(expense / income, 1) * 100 : 100;

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {copy.title}
          {simulated && <span className="text-foreground"> · con la simulación</span>}
        </span>
        <span className="font-medium tabular-nums">
          {share === null ? "—" : `${Math.round(share * 100)} %`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`Parte de los ${copy.income.toLowerCase()} que se llevan los ${copy.expense.toLowerCase()}`}
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
          <span className="text-muted-foreground">{copy.expense}</span>
          <span className="font-medium tabular-nums">{fmt(expense)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-income" aria-hidden />
          <span className="text-muted-foreground">{copy.income}</span>
          <span className="font-medium tabular-nums">{fmt(income)}</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {income === 0
          ? copy.noIncome
          : free >= 0
            ? copy.share(Math.round(share! * 100), fmt(free))
            : copy.over(fmt(-free))}
      </p>
    </div>
  );
}
