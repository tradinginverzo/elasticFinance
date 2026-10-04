import "server-only";

import { getAccountsWithBalance } from "@/lib/accounts";
import { currentMonth, monthRange, shiftMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { getTemplatesWithStatus } from "@/lib/templates";

const MONTHS_FOR_AVERAGE = 3;

// Punto de partida del simulador:
// - saldo actual (suma de cuentas),
// - gastos/ingresos fijos con su monto actual y si faltan por registrar este mes,
// - "otros" ingresos/gastos = promedio mensual total − fijos actuales. Restamos los fijos al
//   promedio (en vez de promediar solo lo no vinculado a un fijo) para no contarlos dos veces
//   cuando se registraron antes de crear el gasto fijo.
// El promedio usa los últimos meses completos con movimientos (hasta 3); si no hay, el mes actual.
export async function getBaseline(workspaceId: string) {
  const month = currentMonth();
  const from = monthRange(shiftMonth(month, -MONTHS_FOR_AVERAGE)).start;
  const to = monthRange(month).start;

  const [accounts, templates, pastTransactions] = await Promise.all([
    getAccountsWithBalance(workspaceId),
    getTemplatesWithStatus(workspaceId),
    db.transaction.findMany({
      where: { workspaceId, date: { gte: from, lt: to } },
      select: { type: true, amountCents: true, date: true },
    }),
  ]);

  let transactions = pastTransactions;
  let source: "average" | "current-month" | "none" = "average";
  if (transactions.length === 0) {
    const { start, end } = monthRange(month);
    transactions = await db.transaction.findMany({
      where: { workspaceId, date: { gte: start, lt: end } },
      select: { type: true, amountCents: true, date: true },
    });
    source = transactions.length > 0 ? "current-month" : "none";
  }

  const monthsWithData =
    new Set(transactions.map((t) => t.date.toISOString().slice(0, 7))).size || 1;
  const averageOf = (type: "INCOME" | "EXPENSE") =>
    Math.round(
      transactions.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amountCents), 0) /
        monthsWithData,
    );
  const fixedOf = (type: "INCOME" | "EXPENSE") =>
    templates.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amountCents), 0);

  return {
    balance: Number(accounts.reduce((s, a) => s + a.balanceCents, BigInt(0))),
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      amount: Number(t.amountCents),
      pending: t.thisMonth.length === 0,
    })),
    otherIncome: Math.max(averageOf("INCOME") - fixedOf("INCOME"), 0),
    otherExpense: Math.max(averageOf("EXPENSE") - fixedOf("EXPENSE"), 0),
    monthsUsed: source === "average" ? monthsWithData : 0,
    source,
  };
}

export type Baseline = Awaited<ReturnType<typeof getBaseline>>;
