import "server-only";

import type { TransactionType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import defaultCategories from "./default-categories.json";

// Categorías con las que empieza cada espacio. Están en un JSON porque también las usa
// scripts/templates-backup.mjs. Se pueden renombrar o ampliar más adelante.
const DEFAULT_CATEGORIES = defaultCategories as {
  name: string;
  type: TransactionType;
  icon: string;
}[];

// Devuelve las categorías del espacio; si aún no tiene ninguna, crea las de por defecto.
export async function getCategories(workspaceId: string) {
  const existing = await db.category.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  if (existing.length > 0) return existing;

  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, workspaceId })),
    skipDuplicates: true, // por si dos peticiones las crean a la vez
  });
  return db.category.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
}
