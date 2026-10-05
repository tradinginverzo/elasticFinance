import "server-only";

import type { TransactionType } from "@/generated/prisma/client";
import { CATEGORY_COLORS, firstFreeColor } from "@/lib/category-colors";
import { db } from "@/lib/db";

import defaultCategories from "./default-categories.json";

// Categorías con las que empieza cada espacio. Están en un JSON porque también las usa
// scripts/templates-backup.mjs. Se pueden renombrar o ampliar más adelante.
const DEFAULT_CATEGORIES = defaultCategories as {
  name: string;
  type: TransactionType;
  icon: string;
}[];

const orderByName = { name: "asc" } as const;

// Devuelve las categorías del espacio; si aún no tiene ninguna, crea las de por defecto.
// Además, a las que no tengan color (creadas antes de existir los colores, o por copias/scripts)
// les asigna uno libre de la paleta, sin repetir.
export async function getCategories(workspaceId: string) {
  let categories = await db.category.findMany({ where: { workspaceId }, orderBy: orderByName });

  if (categories.length === 0) {
    await db.category.createMany({
      data: DEFAULT_CATEGORIES.map((c, i) => ({
        ...c,
        workspaceId,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })),
      skipDuplicates: true, // por si dos peticiones las crean a la vez
    });
    return db.category.findMany({ where: { workspaceId }, orderBy: orderByName });
  }

  const withoutColor = categories.filter((c) => !c.color);
  if (withoutColor.length > 0) {
    const used = categories.map((c) => c.color);
    for (const category of withoutColor) {
      const color = firstFreeColor(used);
      if (!color) break; // paleta agotada: se muestran en gris
      used.push(color);
      await db.category.update({ where: { id: category.id }, data: { color } });
    }
    categories = await db.category.findMany({ where: { workspaceId }, orderBy: orderByName });
  }

  return categories;
}
