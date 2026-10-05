"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCategories } from "@/lib/categories";
import { isMemberOf, requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { listWorkspaces } from "@/lib/workspaces";
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

export type CopyTemplatesState = {
  error: string | null;
  result?: { copied: number; skipped: number; removed: number; targetId: string; targetName: string };
};

// Copia gastos fijos del espacio activo a otro espacio del usuario (p. ej. Personal → Hogar).
// Cuenta y categoría se emparejan por nombre en el destino (si la categoría no existe, se crea;
// si la cuenta no existe, queda "elegir al registrar"). Los que ya existen allí con el mismo
// nombre y tipo se omiten. Con "removeOriginals" se borran del origen tras copiarlos (= mover);
// sus movimientos ya registrados se conservan en el origen.
export async function copyTemplates(
  _prev: CopyTemplatesState,
  formData: FormData,
): Promise<CopyTemplatesState> {
  const { profile, workspace: source } = await requireWorkspace();
  const targetId = String(formData.get("targetId") ?? "");
  const ids = formData.getAll("templateIds").map(String);
  const removeOriginals = formData.get("removeOriginals") === "on";

  if (ids.length === 0) return { error: "Marca al menos un gasto fijo." };
  if (!targetId || targetId === source.id) return { error: "Elige el espacio de destino." };
  const target = (await listWorkspaces(profile.id)).find((w) => w.id === targetId);
  if (!target) return { error: "Ese espacio no existe." };

  // Solo gastos fijos del espacio activo.
  const templates = await db.transactionTemplate.findMany({
    where: { id: { in: ids }, workspaceId: source.id },
    include: { category: { select: { name: true } }, account: { select: { name: true } } },
  });

  // getCategories crea las categorías por defecto del destino si aún no tiene ninguna.
  const [categories, accounts, existing] = await Promise.all([
    getCategories(target.id),
    db.account.findMany({ where: { workspaceId: target.id }, select: { id: true, name: true } }),
    db.transactionTemplate.findMany({ where: { workspaceId: target.id }, select: { name: true, type: true } }),
  ]);
  const key = (name: string, type: string) => `${type}:${name.trim().toLocaleLowerCase("es")}`;
  const existingKeys = new Set(existing.map((t) => key(t.name, t.type)));
  const categoryByKey = new Map(categories.map((c) => [key(c.name, c.type), c.id]));
  const accountByName = new Map(accounts.map((a) => [a.name.trim().toLocaleLowerCase("es"), a.id]));

  const toCopy = templates.filter((t) => !existingKeys.has(key(t.name, t.type)));

  await db.$transaction(async (tx) => {
    for (const t of toCopy) {
      let categoryId = t.category ? (categoryByKey.get(key(t.category.name, t.type)) ?? null) : null;
      if (t.category && !categoryId) {
        const created = await tx.category.create({
          data: { workspaceId: target.id, name: t.category.name, type: t.type },
        });
        categoryId = created.id;
        categoryByKey.set(key(t.category.name, t.type), categoryId);
      }
      await tx.transactionTemplate.create({
        data: {
          workspaceId: target.id,
          name: t.name,
          type: t.type,
          amountCents: t.amountCents,
          merchant: t.merchant,
          categoryId,
          accountId: t.account ? (accountByName.get(t.account.name.trim().toLocaleLowerCase("es")) ?? null) : null,
        },
      });
    }
    if (removeOriginals) {
      // Se borran todos los marcados (también los omitidos porque ya existían en el destino).
      await tx.transactionTemplate.deleteMany({ where: { id: { in: templates.map((t) => t.id) } } });
    }
  });

  return {
    error: null,
    result: {
      copied: toCopy.length,
      skipped: templates.length - toCopy.length,
      removed: removeOriginals ? templates.length : 0,
      targetId: target.id,
      targetName: target.name,
    },
  };
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
