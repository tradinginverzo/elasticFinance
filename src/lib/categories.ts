import "server-only";

import type { TransactionType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// Categorías con las que empieza cada espacio. Se pueden renombrar o ampliar más adelante.
const DEFAULT_CATEGORIES: { name: string; type: TransactionType; icon: string }[] = [
  { name: "Comida", type: "EXPENSE", icon: "utensils" },
  { name: "Supermercado", type: "EXPENSE", icon: "shopping-cart" },
  { name: "Transporte", type: "EXPENSE", icon: "car" },
  { name: "Hogar", type: "EXPENSE", icon: "home" },
  { name: "Servicios", type: "EXPENSE", icon: "zap" },
  { name: "Salud", type: "EXPENSE", icon: "heart-pulse" },
  { name: "Ocio", type: "EXPENSE", icon: "party-popper" },
  { name: "Compras", type: "EXPENSE", icon: "shopping-bag" },
  { name: "Educación", type: "EXPENSE", icon: "graduation-cap" },
  { name: "Otros gastos", type: "EXPENSE", icon: "circle-ellipsis" },
  { name: "Sueldo", type: "INCOME", icon: "briefcase" },
  { name: "Ingreso extra", type: "INCOME", icon: "sparkles" },
  { name: "Otros ingresos", type: "INCOME", icon: "circle-ellipsis" },
];

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
