"use client";

import { AlertTriangleIcon, InfoIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";

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

export function Simulator({
  baseline,
  currency,
  workspaceName,
}: {
  baseline: Baseline;
  currency: string;
  workspaceName: string;
}) {
  const fmt = (cents: number) => formatAmount(cents, currency);

  // ── Tu situación (precargada con tus datos, editable) ──
  const [balance, setBalance] = useState(centsToInput(BigInt(baseline.balance)));
  const [otherIncome, setOtherIncome] = useState(centsToInput(BigInt(baseline.otherIncome)));
  const [otherExpense, setOtherExpense] = useState(centsToInput(BigInt(baseline.otherExpense)));
  // Gastos/ingresos fijos pendientes de este mes que el usuario quitó con ✕.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const fixedIncomes = baseline.templates.filter((t) => t.type === "INCOME");
  const fixedExpenses = baseline.templates.filter((t) => t.type === "EXPENSE");
  const pending = baseline.templates.filter((t) => t.pending);
  const pendingIncluded = pending.filter((t) => !excluded.has(t.id));
  // Lo que aún entra/sale este mes por fijos sin registrar (ya registrados = ya están en el saldo).
  const pendingNet = pendingIncluded.reduce(
    (s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount),
    0,
  );

  function toggleExcluded(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
  const [recurringAction, setRecurringAction] = useState<RecurringAction>("add");
  const [cancelId, setCancelId] = useState(fixedExpenses[0]?.id ?? "");
  const [horizon, setHorizon] = useState<"6" | "12" | "24">("12");

  const cancelTemplate = fixedExpenses.find((t) => t.id === cancelId);

  // Cálculo barato: se rehace en cada render (React Compiler se encarga de optimizar).
  const computed = (() => {
    const balanceCents = parseSigned(balance);
    const otherIncomeCents = parseOptional(otherIncome);
    const otherExpenseCents = parseOptional(otherExpense);
    const amountCents =
      kind === "recurring" && recurringAction === "cancel"
        ? (cancelTemplate?.amount ?? 0)
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
    recurringAction === "cancel" ? (cancelTemplate?.amount ?? 0) : (parseOptional(amount) ?? 0);
  const horizonLabel = HORIZON_OPTIONS.find((h) => h.value === horizon)!.label;

  const labels =
    kind === "purchase"
      ? { baseline: "Sin la compra", withScenario: "Con la compra" }
      : kind === "income"
        ? { baseline: "Sin el ingreso", withScenario: "Con el ingreso" }
        : recurringAction === "add"
          ? { baseline: "Sin el gasto nuevo", withScenario: "Con el gasto nuevo" }
          : { baseline: "Si lo mantienes", withScenario: "Si lo cancelas" };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      {/* ── Formulario ─────────────────────────────────────────────── */}
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
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

            {pending.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label>
                    Fijos sin registrar en {formatMonth(currentMonth())}
                  </Label>
                  <span className={cn("text-sm font-medium tabular-nums", pendingNet < 0 ? "text-expense" : pendingNet > 0 && "text-income")}>
                    {pendingNet > 0 ? "+" : pendingNet < 0 ? "−" : ""}
                    {fmt(Math.abs(pendingNet))}
                  </span>
                </div>
                <ul className="divide-y rounded-xl border text-sm">
                  {pending.map((t) => {
                    const isExcluded = excluded.has(t.id);
                    return (
                      <li key={t.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                        <span className={cn("min-w-0 flex-1 truncate", isExcluded && "text-muted-foreground line-through")}>
                          {t.name}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums",
                            isExcluded ? "text-muted-foreground line-through" : t.type === "EXPENSE" ? "text-expense" : "text-income",
                          )}
                        >
                          {t.type === "EXPENSE" ? "−" : "+"}
                          {fmt(t.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExcluded(t.id)}
                          aria-label={isExcluded ? `Volver a incluir ${t.name}` : `Quitar ${t.name}`}
                          title={isExcluded ? "Volver a incluir" : "Quitar (ya pagado o no toca este mes)"}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {isExcluded ? <RotateCcwIcon className="size-3.5" /> : <XIcon className="size-4" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-3 py-2">
                  <span className="text-sm">Disponible hoy</span>
                  <span className={cn("font-semibold tabular-nums", available < 0 && "text-expense")}>{fmt(available)}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t pt-4">
              <p className="text-sm font-medium">Cada mes</p>
              <FixedComparison income={sum(fixedIncomes)} expense={sum(fixedExpenses)} currency={currency} />
              <FixedSummary label="Ingresos fijos" items={fixedIncomes} fmt={fmt} />
              <AmountField id="otherIncome" label="Otros ingresos (promedio)" value={otherIncome} onChange={setOtherIncome} invalid={invalid.has("otherIncome")} />
              <FixedSummary label="Gastos fijos" items={fixedExpenses} fmt={fmt} />
              <AmountField id="otherExpense" label="Otros gastos (promedio)" value={otherExpense} onChange={setOtherExpense} invalid={invalid.has("otherExpense")} />
              <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <span>Ahorro mensual</span>
                <span className={cn("font-semibold tabular-nums", monthlySavings < 0 ? "text-expense" : "text-income")}>
                  {monthlySavings < 0 ? "−" : "+"}
                  {fmt(Math.abs(monthlySavings))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                «Otros» es todo lo que no es fijo (comida, salidas…). Se calcula como tu promedio total
                menos los fijos.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="font-medium">¿Qué quieres simular?</h2>
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
                { value: "recurring", label: "Gasto fijo" },
              ]}
            />

            {kind === "recurring" && (
              <div className="flex flex-col gap-2">
                <Segmented
                  label="Añadir o cancelar"
                  value={recurringAction}
                  onChange={setRecurringAction}
                  options={[
                    { value: "add", label: "Añadir uno nuevo" },
                    { value: "cancel", label: "Cancelar uno" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  {recurringAction === "add"
                    ? "Una suscripción, un gimnasio, un seguro… algo que pagarías cada mes."
                    : "Elige uno de tus gastos fijos y mira cuánto ahorrarías sin él."}
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
                  <Label htmlFor="cancelId">Gasto fijo a cancelar</Label>
                  <NativeSelect id="cancelId" value={cancelId} onChange={(e) => setCancelId(e.target.value)}>
                    {fixedExpenses.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {fmt(t.amount)} al mes
                      </option>
                    ))}
                  </NativeSelect>
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
                label={recurringAction === "add" ? "Empiezas a pagarlo" : "Lo cancelas"}
              />
            )}

            <div className="flex flex-col gap-2">
              <Label>Proyectar a</Label>
              <Segmented label="Periodo" value={horizon} onChange={setHorizon} options={HORIZON_OPTIONS} />
            </div>
          </CardContent>
        </Card>
      </form>

      {/* ── Resultados ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {!result ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {invalid.size > 0
                ? "Revisa los montos marcados en rojo."
                : kind === "recurring" && recurringAction === "cancel"
                  ? "Elige el gasto fijo que quieres cancelar."
                  : `Escribe ${kind === "purchase" ? "el precio" : "el monto"} para ver el impacto.`}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-5">
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

// Total de los fijos de un tipo, con el detalle desplegable.
function FixedSummary({
  label,
  items,
  fmt,
}: {
  label: string;
  items: { id: string; name: string; amount: number }[];
  fmt: (cents: number) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">{fmt(0)}</span>
      </div>
    );
  }
  return (
    <details className="group text-sm">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2">
        <span>
          {label} <span className="text-xs text-muted-foreground">({items.length}) · ver</span>
        </span>
        <span className="font-medium tabular-nums">{fmt(sum(items))}</span>
      </summary>
      <ul className="mt-2 flex flex-col gap-1 border-l-2 pl-3 text-xs text-muted-foreground">
        {items.map((t) => (
          <li key={t.id} className="flex justify-between gap-2">
            <span className="truncate">{t.name}</span>
            <span className="tabular-nums">{fmt(t.amount)}</span>
          </li>
        ))}
      </ul>
    </details>
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
