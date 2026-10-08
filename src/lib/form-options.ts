import "server-only";

import { getCategories } from "@/lib/categories";
import { db } from "@/lib/db";
import { onlyFlow } from "@/lib/transaction-types";

// Cuentas y categorías del espacio para los <select> de los formularios.
export async function getFormOptions(workspaceId: string) {
  const [accounts, categories] = await Promise.all([
    db.account.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    getCategories(workspaceId),
  ]);
  return {
    accounts,
    categories: onlyFlow(categories).map(({ id, name, type, color }) => ({ id, name, type, color })),
  };
}
