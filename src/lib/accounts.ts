import "server-only";

import type { AccountType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Efectivo",
  BANK: "Cuenta bancaria",
  CREDIT_CARD: "Tarjeta de crédito",
  SAVINGS: "Ahorro",
};

// Cuentas del espacio con su saldo actual =
//   saldo inicial + ingresos − gastos − transferencias enviadas + transferencias recibidas.
export async function getAccountsWithBalance(workspaceId: string) {
  const [accounts, totals, incoming] = await Promise.all([
    db.account.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    // Por cuenta de origen: ingresos, gastos y transferencias que salen.
    db.transaction.groupBy({
      by: ["accountId", "type"],
      where: { workspaceId },
      _sum: { amountCents: true },
      _count: true,
    }),
    // Transferencias que entran a cada cuenta.
    db.transaction.groupBy({
      by: ["toAccountId"],
      where: { workspaceId, type: "TRANSFER" },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return accounts.map((account) => {
    const sum = (type: "INCOME" | "EXPENSE" | "TRANSFER") =>
      totals.find((t) => t.accountId === account.id && t.type === type)?._sum
        .amountCents ?? BigInt(0);
    const received = incoming.find((t) => t.toAccountId === account.id);
    const transactionCount =
      totals.filter((t) => t.accountId === account.id).reduce((n, t) => n + t._count, 0) +
      (received?._count ?? 0);
    return {
      ...account,
      balanceCents:
        account.initialBalanceCents +
        sum("INCOME") -
        sum("EXPENSE") -
        sum("TRANSFER") +
        (received?._sum.amountCents ?? BigInt(0)),
      transactionCount,
    };
  });
}
