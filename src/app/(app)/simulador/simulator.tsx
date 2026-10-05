"use client";

import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, InfoIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { FixedComparison } from "@/components/fixed-comparison";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Baseline } from "@/lib/baseline";
import { currentMonth, formatMonth, monthRange, shiftMonth } from "@/lib/dates";
import { centsToInput, formatAmount, parseAmountToCents } from "@/lib/money";
import { installmentFromRate, simulate, type Scenario } from "@/lib/simulator";
import { cn } from "@/lib/utils";

import { ProjectionChart } from "./projection-chart";

type Kind = "purchase" | "income" | "recurring";
type Payment = "cash" | "credit";
type CreditInput = "installment" | "rate";
type RecurringAction = "add" | "cancel";

const INSTALLMENT_OPTIONS = [3, 6, 9, 12, 18, 24, 36, 48, 60];
const HORIZON_OPTIONS = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "1 año" },
  { value: "24", label: "2 años" },
] as const;
// A partir de este % del ingreso mensual avisamos de que la cuota pesa mucho.
const HIGH_INSTALLMENT_SHARE = 0.3;

// Monto opcional: vacío = 0; texto inválido = null.
function parseOptional(value: string): number | null {
  if (value.trim() === "") return 0;
  const cents = parseAmountToCents(value);
  return cents === null ? null : Number(cents);
}

// Saldo: admite negativo.
function parseSigned(value: string): number | null {
  const negative = value.trim().startsWith("-");
  const parsed = parseOptional(negative ? value.trim().slice(1) : value);
  return parsed === null ? null : negative ? -parsed : parsed;
}

function monthLabel(index: number) {
  if (index === 0) return "Hoy";
  const { start } = monthRange(shiftMonth(currentMonth(), index));
  return new Intl.DateTimeFormat("es", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(start)
    .replace(".", "");
}

const sum = (items: { amount: number }[]) => items.reduce((s, t) => s + t.amount, 0);

// Orden de las listas de gastos/ingresos fijos del simulador (gastos e ingresos van siempre
// agrupados por separado; el orden se aplica dentro de cada grupo).
type SortBy = "amount" | "name" | "category";
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "amount", label: "Monto" },
  { value: "name", label: "Nombre" },
  { value: "category", label: "Categoría" },
];

type SortDir = "asc" | "desc";
// Dirección con la que empieza cada criterio al elegirlo (el monto, de mayor a menor).
const DEFAULT_DIR: Record<SortBy, SortDir> = { amount: "desc", name: "asc", category: "asc" };

// asc: monto de menor a mayor / nombre o categoría A→Z. desc: al revés.
// En empates, por nombre A→Z. Los que no tienen categoría van al final.
function sortTemplates<T extends { name: string; amount: number; categoryName: string | null }>(
  items: T[],
  sortBy: SortBy,
  dir: SortDir,
) {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "es");
  const byCategory = (a: T, b: T) =>
    a.categoryName === b.categoryName
      ? 0
      : a.categoryName === null
        ? 1
        : b.categoryName === null
          ? -1
          : sign * a.categoryName.localeCompare(b.categoryName, "es");
  const primary = (a: T, b: T) =>
    sortBy === "amount" ? sign * (a.amount - b.amount) : sortBy === "name" ? sign * byName(a, b) : byCategory(a, b);
  return [...items].sort((a, b) => primary(a, b) || byName(a, b));
}

function SortSelect({
  value,
  dir,
  onChange,
}: {
  value: SortBy;
  dir: SortDir;
  onChange: (value: SortBy, dir: SortDir) => void;
}) {
  const DirIcon = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <label className="flex items-center gap-1">
        Ordenar:
        <select
          value={value}
          onChange={(e) => {
            const next = e.target.value as SortBy;
            onChange(next, DEFAULT_DIR[next]);
          }}
          className="rounded-md bg-transparent py-0.5 font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onChange(value, dir === "asc" ? "desc" : "asc")}
        aria-label={dir === "asc" ? "Orden ascendente. Cambiar a descendente" : "Orden descendente. Cambiar a ascendente"}
        title={dir === "asc" ? "Ascendente" : "Descendente"}
        className="flex size-6 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        <DirIcon className="size-3.5" />
      </button>
    </span>
  );
}

type SimulatorProps = { baseline: Baseline; currency: string; workspaceName: string };

// "Reiniciar" vuelve a montar el simulador desde cero: así todo (escenario y "Tu situación")
// recupera sus valores iniciales sin tener que restablecer cada campo a mano.
export function Simulator(props: SimulatorProps) {
  const [resetCount, setResetCount] = useState(0);
  return <SimulatorForm key={resetCount} {...props} onReset={() => setResetCount((n) => n + 1)} />;
}

function SimulatorForm({
  baseline,
  currency,
  workspaceName,
  onReset,
}: SimulatorProps & { onReset: () => void }) {
  const fmt = (cents: number) => formatAmount(cents, currency);

  // ── Tu situación (precargada con tus datos, editable) ──
  const [balance, setBalance] = useState(centsToInput(BigInt(baseline.balance)));
  const [otherIncome, setOtherIncome] = useState(centsToInput(BigInt(baseline.otherIncome)));
  const [otherExpense, setOtherExpense] = useState(centsToInput(BigInt(baseline.otherExpense)));

  const [sortBy, setSortBy] = useState<SortBy>("amount");
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_DIR.amount);
  const sorted = sortTemplates(baseline.templates, sortBy, sortDir);
  function changeSort(by: SortBy, dir: SortDir) {
    setSortBy(by);
    setSortDir(dir);
  }
  const fixedIncomes = sorted.filter((t) => t.type === "INCOME");
  const fixedExpenses = sorted.filter((t) => t.type === "EXPENSE");
  const pending = sorted.filter((t) => t.pending);
  // Lo que aún entra/sale este mes por fijos sin registrar (ya registrados = ya están en el saldo).
  // Si ya pagaste uno, lo correcto es registrarlo en Movimientos: así deja de estar pendiente.
  const pendingNet = pending.reduce((s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount), 0);

  // ── Escenario ──
  const [kind, setKind] = useState<Kind>("purchase");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [downPayment, setDownPayment] = useState("");
  const [installments, setInstallments] = useState("12");
  const [creditInput, setCreditInput] = useState<CreditInput>("installment");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [rate, setRate] = useState("");
  const [firstMonth, setFirstMonth] = useState<"0" | "1">("1");
  const [recurrence, setRecurrence] = useState<"once" | "monthly">("once");
  const [incomeMonths, setIncomeMonths] = useState("");
  const [recurringAction, setRecurringAction] = useState<RecurringAction>("cancel");
  // Gastos fijos que el usuario marca para simular dejar de pagarlos (puede ser varios).
  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set());
  const [horizon, setHorizon] = useState<"6" | "12" | "24">("12");

  const cancelTemplates = fixedExpenses.filter((t) => cancelIds.has(t.id));
  const cancelTotal = sum(cancelTemplates);
  function toggleCancel(id: string) {
    setCancelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Cálculo barato: se rehace en cada render (React Compiler se encarga de optimizar).
  const computed = (() => {
    const balanceCents = parseSigned(balance);
    const otherIncomeCents = parseOptional(otherIncome);
    const otherExpenseCents = parseOptional(otherExpense);
    const amountCents =
      kind === "recurring" && recurringAction === "cancel"
        ? cancelTotal
        : parseOptional(amount);
    const down = parseOptional(downPayment);
    const n = Number(installments);
    const ratePercent = rate.trim() === "" ? 0 : Number(rate.replace(",", "."));

    const invalid = new Set<string>();
    if (balanceCents === null) invalid.add("balance");
    if (otherIncomeCents === null) invalid.add("otherIncome");
    if (otherExpenseCents === null) invalid.add("otherExpense");
    if (amountCents === null) invalid.add("amount");
    if (down === null) invalid.add("downPayment");
    if (!Number.isFinite(ratePercent) || ratePercent < 0) invalid.add("rate");

    let installment = 0;
    if (kind === "purchase" && payment === "credit" && amountCents !== null && down !== null) {
      if (creditInput === "rate") {
        installment = installmentFromRate(Math.max(amountCents - down, 0), ratePercent || 0, n);
      } else {
        const parsed = parseOptional(installmentAmount);
        if (parsed === null) invalid.add("installmentAmount");
        installment = parsed ?? 0;
      }
    }

    const monthlyIncome = sum(fixedIncomes) + (otherIncomeCents ?? 0);
    const monthlyExpense = sum(fixedExpenses) + (otherExpenseCents ?? 0);
    const available = (balanceCents ?? 0) + pendingNet;

    if (invalid.size > 0 || !amountCents) {
      return { invalid, result: null, cashResult: null, installment, monthlyIncome, monthlyExpense, available };
    }

    // La proyección arranca del saldo disponible: saldo de las cuentas ± fijos pendientes del mes.
    const base = { balance: available, monthlyIncome, monthlyExpense };
    const months = Number(horizon);
    const start = Number(firstMonth) as 0 | 1;
    let scenario: Scenario;
    if (kind === "recurring") {
      scenario = { kind: "recurring", action: recurringAction, amount: amountCents, firstMonth: start };
    } else if (kind === "income") {
      const duration = Number(incomeMonths);
      scenario = {
        kind: "income",
        amount: amountCents,
        recurrence,
        months: recurrence === "monthly" && duration > 0 ? duration : null,
        firstMonth: start,
      };
    } else if (payment === "cash") {
      scenario = { kind: "purchase", payment: "cash", amount: amountCents };
    } else {
      scenario = {
        kind: "purchase",
        payment: "credit",
        amount: amountCents,
        downPayment: down ?? 0,
        installments: n,
        installmentAmount: installment,
        firstMonth: start,
      };
    }

    const result = simulate(base, scenario, months);
    // Para comparar: la misma compra pagada al contado.
    const cashResult =
      kind === "purchase" && payment === "credit"
        ? simulate(base, { kind: "purchase", payment: "cash", amount: amountCents }, months)
        : null;
    return { invalid, result, cashResult, installment, monthlyIncome, monthlyExpense, available };
  })();

  const { invalid, result, cashResult, installment, monthlyIncome, monthlyExpense, available } =
    computed;
  const monthlySavings = monthlyIncome - monthlyExpense;
  // Monto mensual del gasto fijo que se añade o se cancela.
  const recurringMonthly =
    recurringAction === "cancel" ? cancelTotal : (parseOptional(amount) ?? 0);
  const horizonLabel = HORIZON_OPTIONS.find((h) => h.value === horizon)!.label;
  // Simular cancelar/añadir un gasto fijo: lo reflejamos también en "Tu situación".
  const simulatedCancelIds =
    kind === "recurring" && recurringAction === "cancel" ? cancelIds : new Set<string>();
  // "Gym", "Gym y Netflix", "Gym, Netflix y Spotify" (para explicar la comparación).
  const cancelNames = new Intl.ListFormat("es", { type: "conjunction" }).format(
    cancelTemplates.map((t) => t.name),
  );
  const simulatedSavingsChange =
    kind === "recurring" ? (recurringAction === "cancel" ? recurringMonthly : -recurringMonthly) : 0;

  const labels =
    kind === "purchase"
      ? { baseline: "Sin la compra", withScenario: "Con la compra" }
      : kind === "income"
        ? { baseline: "Sin el ingreso", withScenario: "Con el ingreso" }
        : recurringAction === "add"
          ? { baseline: "Sin el gasto nuevo", withScenario: "Con el gasto nuevo" }
          : cancelTemplates.length === 1
            ? { baseline: "Si sigues pagándolo", withScenario: "Si lo quitas" }
            : { baseline: "Si sigues pagándolos", withScenario: "Si los quitas" };

  // ¿Cambió algo respecto a cómo se abrió el simulador? (el orden de la lista no cuenta)
  const isDirty =
    balance !== centsToInput(BigInt(baseline.balance)) ||
    otherIncome !== centsToInput(BigInt(baseline.otherIncome)) ||
    otherExpense !== centsToInput(BigInt(baseline.otherExpense)) ||
    kind !== "purchase" ||
    amount !== "" ||
    payment !== "cash" ||
    downPayment !== "" ||
    installments !== "12" ||
    creditInput !== "installment" ||
    installmentAmount !== "" ||
    rate !== "" ||
    firstMonth !== "1" ||
    recurrence !== "once" ||
    incomeMonths !== "" ||
    recurringAction !== "cancel" ||
    cancelIds.size > 0 ||
    horizon !== "12";

  // Elegir qué gastos fijos quitar se hace con casillas en la lista única de fijos (abajo).
  const selectingCancel = kind === "recurring" && recurringAction === "cancel";
  const addedAmount = kind === "recurring" && recurringAction === "add" ? recurringMonthly : 0;

  const situationCard = (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Tu situación</h2>
          <p className="text-xs text-muted-foreground">
            {baseline.source === "average"
              ? `Con tus gastos fijos y el promedio de tus últimos ${baseline.monthsUsed === 1 ? "mes" : `${baseline.monthsUsed} meses`} en ${workspaceName}. Puedes ajustarlo.`
              : baseline.source === "current-month"
                ? `Con tus gastos fijos y lo que llevas este mes en ${workspaceName}. Ajústalo si el mes no está completo.`
                : "Con tus gastos fijos. Escribe también lo que sueles gastar e ingresar aparte."}
          </p>
        </div>

        <AmountField id="balance" label="Saldo en tus cuentas" value={balance} onChange={setBalance} invalid={invalid.has("balance")} />

        {baseline.templates.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Tus gastos e ingresos fijos</Label>
              <SortSelect value={sortBy} dir={sortDir} onChange={changeSort} />
            </div>

            {selectingCancel && (
              <p className="rounded-lg bg-series-2/10 px-3 py-2 text-xs">
                Marca las casillas de los gastos que dejarías de pagar.
                {cancelIds.size > 0 && (
                  <>
                    {" "}
                    <QuickAction onClick={() => setCancelIds(new Set())}>Desmarcar todos</QuickAction>
                  </>
                )}
              </p>
            )}

            {pending.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pending.length} sin registrar en {formatMonth(currentMonth())} (
                <span className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-400">pendiente</span>
                ). Si ya pagaste alguno, regístralo en Movimientos.
              </p>
            )}

            {/* Una sola lista: agrupada por tipo, con el orden elegido dentro de cada grupo. */}
            <div className="overflow-hidden rounded-xl border text-sm">
              {PENDING_GROUPS.map(({ type: groupType, label: groupLabel }) => {
                const items = sorted.filter((t) => t.type === groupType);
                const extra = groupType === "EXPENSE" ? addedAmount : 0;
                if (items.length === 0 && extra === 0) return null;
                const total = sum(items);
                const simulatedTotal = total - sum(items.filter((t) => simulatedCancelIds.has(t.id))) + extra;
                return (
                  <section key={groupType} className="border-b last:border-b-0">
                    <h3 className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-1.5 text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className={cn("size-2 rounded-full", groupType === "EXPENSE" ? "bg-expense" : "bg-income")} />
                        {groupLabel} al mes
                        <span className="font-normal text-muted-foreground">({items.length})</span>
                      </span>
                      <span className={cn("tabular-nums", groupType === "EXPENSE" ? "text-expense" : "text-income")}>
                        {simulatedTotal !== total && (
                          <span className="font-normal text-muted-foreground line-through">{fmt(total)} </span>
                        )}
                        {groupType === "EXPENSE" ? "−" : "+"}
                        {fmt(simulatedTotal)}
                      </span>
                    </h3>
                    <ul className="divide-y">
                      {items.map((t) => (
                        <FixedRow
                          key={t.id}
                          template={t}
                          fmt={fmt}
                          selectable={selectingCancel && t.type === "EXPENSE"}
                          cancelled={simulatedCancelIds.has(t.id)}
                          onToggleCancel={() => toggleCancel(t.id)}
                        />
                      ))}
                      {extra > 0 && (
                        <li className="flex items-center gap-2 py-1.5 pr-3 pl-3">
                          <span className="min-w-0 flex-1 truncate">Gasto nuevo</span>
                          <SimulatedTag>simulado</SimulatedTag>
                          <span className="text-expense tabular-nums">−{fmt(extra)}</span>
                        </li>
                      )}
                    </ul>
                  </section>
                );
              })}
            </div>

            {pending.length > 0 && (
              <div className="flex flex-col rounded-xl bg-muted/60 px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">Disponible hoy</span>
                  <span className={cn("font-semibold tabular-nums", available < 0 && "text-expense")}>{fmt(available)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Tu saldo {pendingNet < 0 ? "menos" : "más"} los fijos pendientes de este mes ({pendingNet < 0 ? "−" : "+"}
                  {fmt(Math.abs(pendingNet))}).
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Cada mes</p>
          <FixedComparison
            income={sum(fixedIncomes)}
            expense={sum(fixedExpenses) - simulatedSavingsChange}
            currency={currency}
            simulated={simulatedSavingsChange !== 0}
          />
          <AmountField id="otherIncome" label="Otros ingresos (promedio)" value={otherIncome} onChange={setOtherIncome} invalid={invalid.has("otherIncome")} />
          <AmountField id="otherExpense" label="Otros gastos (promedio)" value={otherExpense} onChange={setOtherExpense} invalid={invalid.has("otherExpense")} />
          <div className="flex flex-col gap-1 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span>Ahorro mensual{simulatedSavingsChange !== 0 && <span className="text-muted-foreground"> hoy</span>}</span>
              <span className={cn("font-semibold tabular-nums", monthlySavings < 0 ? "text-expense" : "text-income")}>
                {monthlySavings < 0 ? "−" : "+"}
                {fmt(Math.abs(monthlySavings))}
              </span>
            </div>
            {simulatedSavingsChange !== 0 && (
              <div className="flex items-baseline justify-between border-t border-border/60 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded-full bg-series-2" aria-hidden />
                  Con la simulación
                </span>
                <span className={cn("font-semibold tabular-nums", monthlySavings + simulatedSavingsChange < 0 ? "text-expense" : "text-income")}>
                  {monthlySavings + simulatedSavingsChange < 0 ? "−" : "+"}
                  {fmt(Math.abs(monthlySavings + simulatedSavingsChange))}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            «Otros» es todo lo que no es fijo (comida, salidas…). Se calcula como tu promedio total menos
            los fijos.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      {/* ── Formulario ─────────────────────────────────────────────── */}
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">¿Qué quieres simular?</h2>
              {isDirty && (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcwIcon className="size-3.5" />
                  Reiniciar
                </button>
              )}
            </div>
            <Segmented
              label="Tipo de simulación"
              value={kind}
              onChange={(value) => {
                setKind(value);
                setFirstMonth("1");
              }}
              options={[
                { value: "purchase", label: "Compra" },
                { value: "income", label: "Ingreso" },
                { value: "recurring", label: "Gastos fijos" },
              ]}
            />

            {kind === "recurring" && (
              <div className="flex flex-col gap-2">
                <Segmented
                  label="Quitar o añadir gastos fijos"
                  value={recurringAction}
                  onChange={setRecurringAction}
                  options={[
                    { value: "cancel", label: "Quitar gastos fijos" },
                    { value: "add", label: "Añadir uno nuevo" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  {recurringAction === "add"
                    ? "Una suscripción, un gimnasio, un seguro… algo que empezarías a pagar cada mes."
                    : "Marca los que dejarías de pagar (por ejemplo, darte de baja de una suscripción) y mira cuánto ahorrarías comparado con seguir pagándolos."}
                </p>
              </div>
            )}

            {kind === "recurring" && recurringAction === "cancel" ? (
              fixedExpenses.length === 0 ? (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  Aún no tienes gastos fijos guardados. Créalos en Movimientos → Gastos fijos.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">
                    {cancelTemplates.length === 0
                      ? "↓ Marca en «Tus gastos e ingresos fijos» (más abajo) los que dejarías de pagar."
                      : `Quitas: ${cancelNames}.`}
                  </p>
                  <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <span>
                      Ahorrarías al mes
                      {cancelTemplates.length > 0 && (
                        <span className="text-muted-foreground"> ({cancelTemplates.length})</span>
                      )}
                    </span>
                    <span className="font-semibold text-income tabular-nums">+{fmt(cancelTotal)}</span>
                  </div>
                </div>
              )
            ) : (
              <AmountField
                id="amount"
                label={kind === "purchase" ? "Precio" : kind === "income" ? "Monto del ingreso" : "Monto mensual"}
                value={amount}
                onChange={setAmount}
                invalid={invalid.has("amount")}
                large
              />
            )}

            {kind === "purchase" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Forma de pago</Label>
                  <Segmented
                    label="Forma de pago"
                    value={payment}
                    onChange={setPayment}
                    options={[
                      { value: "cash", label: "Contado" },
                      { value: "credit", label: "A crédito" },
                    ]}
                  />
                </div>

                {payment === "credit" && (
                  <div className="flex flex-col gap-4 rounded-xl border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="installments">Cuotas</Label>
                        <NativeSelect id="installments" value={installments} onChange={(e) => setInstallments(e.target.value)}>
                          {INSTALLMENT_OPTIONS.map((n) => (
                            <option key={n} value={n}>{n} meses</option>
                          ))}
                        </NativeSelect>
                      </div>
                      <AmountField id="downPayment" label="Pago inicial" value={downPayment} onChange={setDownPayment} invalid={invalid.has("downPayment")} placeholder="Opcional" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>¿Qué dato tienes?</Label>
                      <Segmented
                        label="Dato del crédito"
                        value={creditInput}
                        onChange={setCreditInput}
                        options={[
                          { value: "installment", label: "La cuota" },
                          { value: "rate", label: "La tasa" },
                        ]}
                      />
                    </div>

                    {creditInput === "installment" ? (
                      <AmountField id="installmentAmount" label="Cuota mensual" value={installmentAmount} onChange={setInstallmentAmount} invalid={invalid.has("installmentAmount")} />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="rate">Tasa de interés anual (%)</Label>
                        <Input
                          id="rate"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0 si es sin intereses"
                          className="h-10"
                          value={rate}
                          aria-invalid={invalid.has("rate") || undefined}
                          onChange={(e) => setRate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Cuota calculada: <span className="font-medium text-foreground tabular-nums">{fmt(installment)}</span>
                        </p>
                      </div>
                    )}

                    <StartField value={firstMonth} onChange={setFirstMonth} label="Primera cuota" />
                  </div>
                )}
              </>
            )}

            {kind === "income" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Frecuencia</Label>
                  <Segmented
                    label="Frecuencia"
                    value={recurrence}
                    onChange={setRecurrence}
                    options={[
                      { value: "once", label: "Una vez" },
                      { value: "monthly", label: "Cada mes" },
                    ]}
                  />
                </div>
                {recurrence === "monthly" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="incomeMonths">Durante cuántos meses</Label>
                    <Input
                      id="incomeMonths"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Vacío = todo el periodo"
                      className="h-10"
                      value={incomeMonths}
                      onChange={(e) => setIncomeMonths(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                )}
                <StartField value={firstMonth} onChange={setFirstMonth} label="Lo recibes" />
              </>
            )}

            {kind === "recurring" && (
              <StartField
                value={firstMonth}
                onChange={setFirstMonth}
                label={recurringAction === "add" ? "Empiezas a pagarlo" : "Dejas de pagarlos"}
              />
            )}

            <div className="flex flex-col gap-2">
              <Label>Proyectar a</Label>
              <Segmented label="Periodo" value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS} />
            </div>
          </CardContent>
        </Card>

        {situationCard}
      </form>

      {/* ── Resultados ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {!result ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {invalid.size > 0
                ? "Revisa los montos marcados en rojo."
                : kind === "recurring" && recurringAction === "cancel"
                  ? "Marca los gastos fijos que dejarías de pagar para ver cuánto ahorrarías."
                  : `Escribe ${kind === "purchase" ? "el precio" : "el monto"} para ver el impacto.`}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-5">
                {kind === "recurring" && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    {recurringAction === "cancel"
                      ? `Comparamos seguir pagando ${cancelNames} con dejar de pagar${cancelTemplates.length === 1 ? "lo" : "los"} desde ${firstMonth === "0" ? "este mes" : "el próximo mes"}.`
                      : `Comparamos tu situación actual con añadir un gasto fijo de ${fmt(recurringMonthly)} al mes desde ${firstMonth === "0" ? "este mes" : "el próximo mes"}.`}
                  </p>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">En {horizonLabel} tendrías</p>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{fmt(result.finalWithScenario)}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className={cn("font-medium tabular-nums", result.difference < 0 ? "text-expense" : "text-income")}>
                      {result.difference < 0 ? "−" : "+"}
                      {fmt(Math.abs(result.difference))}
                    </span>{" "}
                    frente a {labels.baseline.toLowerCase()} ({fmt(result.finalBaseline)})
                  </p>
                </div>
                <ProjectionChart
                  currency={currency}
                  labels={labels}
                  data={result.points.map((p) => ({
                    label: monthLabel(p.index),
                    baseline: p.baseline,
                    withScenario: p.withScenario,
                  }))}
                />
              </CardContent>
            </Card>

            <Alerts result={result} fmt={fmt} />

            <div className="grid gap-3 sm:grid-cols-2">
              {result.credit && (
                <>
                  <Stat label="Cuota mensual" value={fmt(result.credit.installmentAmount)} hint={`Hasta ${monthLabel(result.credit.lastMonth)}`} />
                  <Stat
                    label="Parte de tu ingreso"
                    value={result.credit.shareOfIncome === null ? "—" : `${Math.round(result.credit.shareOfIncome * 100)} %`}
                    hint="Lo que se lleva la cuota cada mes"
                  />
                  <Stat label="Pagarás en total" value={fmt(result.credit.totalPaid)} />
                  <Stat label="Intereses" value={fmt(Math.max(result.credit.interest, 0))} hint={result.credit.interest <= 0 ? "Sin intereses" : undefined} />
                </>
              )}
              {kind === "purchase" && payment === "cash" && (
                <>
                  <Stat label="Tu saldo hoy pasaría a" value={fmt(result.points[0].withScenario)} />
                  <Stat
                    label="Para recuperarlo"
                    value={result.recoveryMonths === null ? "—" : `${result.recoveryMonths} ${result.recoveryMonths === 1 ? "mes" : "meses"}`}
                    hint={result.recoveryMonths === null ? "Ahora mismo no ahorras cada mes" : `Ahorrando ${fmt(result.monthlySavings)} al mes`}
                  />
                </>
              )}
              {kind === "income" && (
                <>
                  <Stat label="Recibirías en total" value={fmt(result.difference)} />
                  <Stat label="Tu ahorro mensual actual" value={fmt(result.monthlySavings)} />
                </>
              )}
              {kind === "recurring" && (
                <>
                  <Stat
                    label={recurringAction === "add" ? "Te costaría al mes" : "Ahorrarías al mes"}
                    value={fmt(recurringMonthly)}
                  />
                  <Stat
                    label={recurringAction === "add" ? `Te costaría en ${horizonLabel}` : `Ahorrarías en ${horizonLabel}`}
                    value={fmt(Math.abs(result.difference))}
                  />
                  <Stat
                    label="Tu ahorro mensual pasaría a"
                    value={fmt(result.monthlySavings + (recurringAction === "add" ? -recurringMonthly : recurringMonthly))}
                    hint={`Ahora: ${fmt(result.monthlySavings)}`}
                  />
                </>
              )}
              <Stat label="Saldo más bajo" value={fmt(result.lowest.withScenario)} hint={monthLabel(result.lowest.index)} />
            </div>

            {cashResult && result.credit && (
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <h3 className="font-medium">Contado vs. crédito</h3>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 text-left font-normal" />
                        <th className="pb-2 text-right font-normal">Contado</th>
                        <th className="pb-2 text-right font-normal">Crédito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y tabular-nums">
                      <CompareRow label="Pagas en total" a={fmt(Number(parseOptional(amount)))} b={fmt(result.credit.totalPaid)} />
                      <CompareRow label="Saldo más bajo" a={fmt(cashResult.lowest.withScenario)} b={fmt(result.lowest.withScenario)} />
                      <CompareRow label="Saldo al final" a={fmt(cashResult.finalWithScenario)} b={fmt(result.finalWithScenario)} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            <details className="rounded-xl border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">Ver mes a mes</summary>
              <table className="mt-3 w-full">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 text-left font-normal">Mes</th>
                    <th className="pb-2 text-right font-normal">{labels.baseline}</th>
                    <th className="pb-2 text-right font-normal">{labels.withScenario}</th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {result.points.map((p) => (
                    <tr key={p.index}>
                      <td className="py-1.5 capitalize">{monthLabel(p.index)}</td>
                      <td className="py-1.5 text-right">{fmt(p.baseline)}</td>
                      <td className={cn("py-1.5 text-right", p.withScenario < 0 && "text-expense")}>{fmt(p.withScenario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <p className="flex gap-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              Es una proyección con tus gastos fijos y tus promedios: supone que se mantienen igual cada
              mes. No es una recomendación financiera; la decisión es tuya.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const PENDING_GROUPS = [
  { type: "EXPENSE", label: "Gastos" },
  { type: "INCOME", label: "Ingresos" },
] as const;

// Fila de la lista única de gastos/ingresos fijos del simulador:
// - casilla (solo en "Quitar gastos fijos") para simular dejar de pagarlo;
// - etiqueta "pendiente" si falta registrarlo este mes (se descuenta del disponible de hoy).
function FixedRow({
  template: t,
  fmt,
  selectable,
  cancelled,
  onToggleCancel,
}: {
  template: {
    name: string;
    type: "INCOME" | "EXPENSE";
    amount: number;
    pending: boolean;
    categoryName: string | null;
    categoryColor: string | null;
  };
  fmt: (cents: number) => string;
  selectable: boolean;
  cancelled: boolean;
  onToggleCancel: () => void;
}) {
  const content = (
    <>
      {selectable && (
        <input
          type="checkbox"
          checked={cancelled}
          onChange={onToggleCancel}
          aria-label={`Dejar de pagar ${t.name}`}
          className="size-4 shrink-0 accent-primary"
        />
      )}
      <CategoryBadge name={t.categoryName} color={t.categoryColor} />
      {/* Nombre arriba y etiquetas debajo, para que el nombre no se corte en el iPhone. */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", cancelled && "line-through")}>{t.name}</span>
        {(cancelled || t.pending) && (
          <span className="flex flex-wrap gap-1">
            {cancelled && <SimulatedTag>se quita</SimulatedTag>}
            {t.pending && (
              <span
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                title="Falta registrarlo este mes: se descuenta (o se suma) del disponible de hoy"
              >
                pendiente
              </span>
            )}
          </span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          cancelled ? "text-muted-foreground line-through" : t.type === "EXPENSE" ? "text-expense" : "text-income",
        )}
      >
        {t.type === "EXPENSE" ? "−" : "+"}
        {fmt(t.amount)}
      </span>
    </>
  );

  return (
    <li className="py-1.5 pr-3 pl-3">
      {selectable ? (
        // Toda la fila marca la casilla, para que sea fácil de tocar en el iPhone.
        <label className="flex min-w-0 cursor-pointer items-center gap-2">{content}</label>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{content}</span>
      )}
    </li>
  );
}

function QuickAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}

function SimulatedTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-series-2/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
      {children}
    </span>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
  invalid,
  placeholder = "0,00",
  large = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        className={cn("h-10 tabular-nums", large && "h-12 text-2xl font-semibold md:text-2xl")}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StartField({
  value,
  onChange,
  label,
}: {
  value: "0" | "1";
  onChange: (value: "0" | "1") => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Segmented
        label={label}
        value={value}
        onChange={onChange}
        options={[
          { value: "0", label: "Este mes" },
          { value: "1", label: "El próximo mes" },
        ]}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CompareRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr>
      <td className="py-2 text-muted-foreground">{label}</td>
      <td className="py-2 text-right">{a}</td>
      <td className="py-2 text-right">{b}</td>
    </tr>
  );
}

function Alerts({
  result,
  fmt,
}: {
  result: NonNullable<ReturnType<typeof simulate>>;
  fmt: (cents: number) => string;
}) {
  const alerts: string[] = [];
  if (result.firstNegative) {
    alerts.push(
      result.firstNegative.index === 0
        ? `Tu saldo quedaría en negativo desde hoy (${fmt(result.firstNegative.withScenario)}).`
        : `Tu saldo quedaría en negativo en ${monthLabel(result.firstNegative.index)} (${fmt(result.firstNegative.withScenario)}).`,
    );
  }
  if (result.credit?.shareOfIncome != null && result.credit.shareOfIncome > HIGH_INSTALLMENT_SHARE) {
    alerts.push(
      `La cuota se lleva el ${Math.round(result.credit.shareOfIncome * 100)} % de tu ingreso mensual (más del ${HIGH_INSTALLMENT_SHARE * 100} %).`,
    );
  }
  if (result.monthlySavings < 0) {
    alerts.push(
      `Con tus números actuales gastas ${fmt(-result.monthlySavings)} más de lo que ingresas cada mes.`,
    );
  }
  if (alerts.length === 0) return null;

  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      {alerts.map((text) => (
        <p key={text} className="flex gap-2">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{text}</span>
        </p>
      ))}
    </div>
  );
}
