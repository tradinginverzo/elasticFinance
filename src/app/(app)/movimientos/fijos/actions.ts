"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isMemberOf, requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";

export type TemplateFormState = { error: string | null };

const templateSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre, por ejemplo Alquiler.").max(60),
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.string().trim().min(1, "Escribe el monto habitual."),
  accountId: z.union([z.uuid(), z.literal("")]),
  categoryId: z.union([z.uuid(), z.literal("")]),
  merchant: z.string().trim().max(100),
});

// templateId = null → crear; si no, editar ese gasto fijo.
export async function saveTemplate(
  templateId: string | null,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const { profile, workspace } = await requireWorkspace();

  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const amountCents = parseAmountToCents(input.amount);
  if (amountCents === null || amountCents <= BigInt(0)) {
    return { error: "El monto no es válido. Ejemplo: 1250,50" };
  }

  let workspaceId = workspace.id;
  if (templateId) {
    const existing = await db.transactionTemplate.findUnique({ where: { id: templateId } });
    if (!existing || !(await isMemberOf(profile.id, existing.workspaceId))) {
      return { error: "Ese gasto fijo no existe." };
    }
    workspaceId = existing.workspaceId;
  }

  // Cuenta y categoría deben ser del mismo espacio (y la categoría, del mismo tipo).
  const [account, category] = await Promise.all([
    input.accountId ? db.account.findFirst({ where: { id: input.accountId, workspaceId } }) : null,
    input.categoryId
      ? db.category.findFirst({ where: { id: input.categoryId, workspaceId, type: input.type } })
      : null,
  ]);
  if (input.accountId && !account) return { error: "Elige una cuenta válida." };
  if (input.categoryId && !category) return { error: "Elige una categoría válida." };

  const data = {
    name: input.name,
    type: input.type,
    amountCents,
    accountId: account?.id ?? null,
    categoryId: category?.id ?? null,
    merchant: input.merchant || null,
  };

  if (templateId) {
    await db.transactionTemplate.update({ where: { id: templateId }, data });
  } else {
    await db.transactionTemplate.create({ data: { ...data, workspaceId } });
  }
  redirect("/movimientos/fijos");
}

// Borrar un gasto fijo no borra los movimientos ya registrados con él.
export async function deleteTemplate(templateId: string): Promise<TemplateFormState> {
  const { profile } = await requireWorkspace();
  const existing = await db.transactionTemplate.findUnique({ where: { id: templateId } });
  if (!existing || !(await isMemberOf(profile.id, existing.workspaceId))) {
    return { error: "Ese gasto fijo no existe." };
  }
  await db.transactionTemplate.delete({ where: { id: templateId } });
  redirect("/movimientos/fijos");
}
