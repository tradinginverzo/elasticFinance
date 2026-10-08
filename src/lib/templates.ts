import "server-only";

import { getCategories } from "@/lib/categories";
import { currentMonth, monthRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { onlyFlow } from "@/lib/transaction-types";

// Gastos/ingresos fijos del espacio, con lo registrado este mes para cada uno.
export async function getTemplatesWithStatus(workspaceId: string) {
  // Asegura que las categorías tengan color antes de leerlas (insignias).
  await getCategories(workspaceId);
  const { start, end } = monthRange(currentMonth());
  const templates = await db.transactionTemplate.findMany({
    where: { workspaceId },
    include: {
      category: { select: { name: true, color: true } },
      account: { select: { name: true } },
      transactions: {
        where: { date: { gte: start, lt: end } },
        select: { id: true, amountCents: true, templateAmountCents: true, date: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  // Los gastos fijos solo son ingresos o gastos (nunca transferencias).
  return onlyFlow(templates).map(({ transactions, ...template }) => ({
    ...template,
    thisMonth: transactions,
  }));
}

// Datos mínimos para el selector del formulario de movimientos (serializables;
// forma = TemplateOption de movimientos/transaction-form.tsx).
export async function getTemplateOptions(workspaceId: string) {
  const templates = await getTemplatesWithStatus(workspaceId);
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    amountCents: t.amountCents.toString(),
    accountId: t.accountId,
    categoryId: t.categoryId,
    merchant: t.merchant,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    accountName: t.account?.name ?? null,
    // Fecha del primer registro de este mes ("2026-10-03"), o null si falta registrarlo.
    registeredOn: t.thisMonth[0]?.date.toISOString().slice(0, 10) ?? null,
  }));
}
