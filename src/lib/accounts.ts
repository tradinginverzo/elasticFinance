import "server-only";

import type { AccountType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Efectivo",
  BANK: "Cuenta bancaria",
  CREDIT_CARD: "Tarjeta de crédito",
  SAVINGS: "Ahorro",
};

// Cuentas del espacio con su saldo actual = saldo inicial + ingresos − gastos.
export async function getAccountsWithBalance(workspaceId: string) {
  const [accounts, totals] = await Promise.all([
    db.account.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    db.transaction.groupBy({
      by: ["accountId", "type"],
      where: { workspaceId },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return accounts.map((account) => {
    const sum = (type: "INCOME" | "EXPENSE") =>
      totals.find((t) => t.accountId === account.id && t.type === type)?._sum
        .amountCents ?? BigInt(0);
    const transactionCount = totals
      .filter((t) => t.accountId === account.id)
      .reduce((n, t) => n + t._count, 0);
    return {
      ...account,
      balanceCents: account.initialBalanceCents + sum("INCOME") - sum("EXPENSE"),
      transactionCount,
    };
  });
}
