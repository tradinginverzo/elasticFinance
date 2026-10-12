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
  return onlyFlow(templates).map(({ transactions, ...template }) => {
    const paidCents = transactions.reduce((s, t) => s + t.amountCents, BigInt(0));
    // Con pagos parciales: pagado cuando la suma del mes llega al monto. Si no: con un registro.
    const isPaid = template.allowPartial ? paidCents >= template.amountCents : transactions.length > 0;
    const remainingCents = isPaid
      ? BigInt(0)
      : template.allowPartial
        ? template.amountCents - paidCents
        : template.amountCents;
    return {
      ...template,
      thisMonth: transactions,
      paidCents, // lo registrado este mes
      isPaid,
      isPartial: template.allowPartial && !isPaid && paidCents > BigInt(0),
      remainingCents, // lo que falta este mes
    };
  });
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
    // Fecha del primer registro de este mes ("2026-10-03"), o null si falta (o falta parte).
    registeredOn: t.isPaid ? (t.thisMonth[0]?.date.toISOString().slice(0, 10) ?? null) : null,
    allowPartial: t.allowPartial,
    paidCents: t.paidCents.toString(), // con pagos parciales: lo ya pagado este mes
    remainingCents: t.remainingCents.toString(),
  }));
}
