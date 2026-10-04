"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isMemberOf, requireWorkspace } from "@/lib/context";
import { parseDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";

export type TransactionFormState = { error: string | null };

const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.string().trim().min(1, "Escribe el monto."),
  date: z.string(),
  accountId: z.uuid("Elige una cuenta."),
  categoryId: z.union([z.uuid(), z.literal("")]),
  merchant: z.string().trim().max(100),
  notes: z.string().trim().max(500),
  templateId: z.union([z.uuid(), z.literal("")]).default(""),
});

// transactionId = null → crear; si no, editar ese movimiento.
export async function saveTransaction(
  transactionId: string | null,
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { profile, workspace } = await requireWorkspace();

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const amountCents = parseAmountToCents(input.amount);
  if (amountCents === null || amountCents <= BigInt(0)) {
    return { error: "El monto no es válido. Ejemplo: 1250,50" };
  }
  const date = parseDateInput(input.date);
  if (!date) return { error: "La fecha no es válida." };

  // Al editar, el movimiento se queda en su espacio; al crear, va al espacio activo.
  let workspaceId = workspace.id;
  let existing = null;
  if (transactionId) {
    existing = await db.transaction.findUnique({ where: { id: transactionId } });
    if (!existing || !(await isMemberOf(profile.id, existing.workspaceId))) {
      return { error: "Ese movimiento no existe." };
    }
    workspaceId = existing.workspaceId;
  }

  // La cuenta, la categoría y el gasto fijo tienen que ser del mismo espacio
  // (y la categoría, del mismo tipo).
  const [account, category, template] = await Promise.all([
    db.account.findFirst({ where: { id: input.accountId, workspaceId } }),
    input.categoryId
      ? db.category.findFirst({
          where: { id: input.categoryId, workspaceId, type: input.type },
        })
      : null,
    input.templateId
      ? db.transactionTemplate.findFirst({ where: { id: input.templateId, workspaceId } })
      : null,
  ]);
  if (!account) return { error: "Elige una cuenta válida." };
  if (input.categoryId && !category) return { error: "Elige una categoría válida." };

  const data = {
    type: input.type,
    amountCents,
    currency: account.currency,
    date,
    accountId: account.id,
    categoryId: category?.id ?? null,
    merchant: input.merchant || null,
    notes: input.notes || null,
    templateId: template?.id ?? null,
    // Monto habitual en el momento de registrarlo. Al editar un movimiento del mismo gasto fijo
    // conservamos el que tenía (si después cambió el habitual, este mes no debe verse distinto).
    templateAmountCents: template
      ? existing?.templateId === template.id && existing.templateAmountCents !== null
        ? existing.templateAmountCents
        : template.amountCents
      : null,
  };

  if (transactionId) {
    await db.transaction.update({ where: { id: transactionId }, data });
  } else {
    await db.transaction.create({
      data: { ...data, workspaceId, createdById: profile.id },
    });
  }

  redirect(`/movimientos?mes=${input.date.slice(0, 7)}`);
}

export async function deleteTransaction(transactionId: string): Promise<TransactionFormState> {
  const { profile } = await requireWorkspace();
  const existing = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!existing || !(await isMemberOf(profile.id, existing.workspaceId))) {
    return { error: "Ese movimiento no existe." };
  }

  await db.transaction.delete({ where: { id: transactionId } });
  redirect(`/movimientos?mes=${existing.date.toISOString().slice(0, 7)}`);
}
