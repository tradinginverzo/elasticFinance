"use server";

import { revalidatePath } from "next/cache";

import { isCategoryColor } from "@/lib/category-colors";
import { isMemberOf, requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";

export type CategoryColorState = { error: string | null };

// Cambia el color de una categoría. No se permite repetir un color dentro del mismo espacio.
export async function setCategoryColor(categoryId: string, color: string): Promise<CategoryColorState> {
  const { profile } = await requireWorkspace();
  if (!isCategoryColor(color)) return { error: "Ese color no está en la paleta." };

  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category || !(await isMemberOf(profile.id, category.workspaceId))) {
    return { error: "Esa categoría no existe." };
  }
  if (category.color === color) return { error: null };

  const taken = await db.category.findFirst({
    where: { workspaceId: category.workspaceId, color, id: { not: categoryId } },
    select: { name: true },
  });
  if (taken) return { error: `Ese color ya lo usa «${taken.name}».` };

  await db.category.update({ where: { id: categoryId }, data: { color } });
  revalidatePath("/categorias");
  return { error: null };
}
