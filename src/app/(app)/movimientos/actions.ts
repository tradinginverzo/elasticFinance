"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isMemberOf, requireWorkspace } from "@/lib/context";
import { parseDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";
import { cleanBranch } from "@/lib/prices";

export type TransactionFormState = { error: string | null };

const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.string().trim().min(1, "Escribe el monto."),
  date: z.string(),
  accountId: z.uuid("Elige una cuenta."),
  // Solo transferencias: la cuenta a la que llega el dinero.
  toAccountId: z.union([z.uuid(), z.literal("")]).default(""),
  // Las transferencias no envían categoría (el campo no se muestra).
  categoryId: z.union([z.uuid(), z.literal("")]).default(""),
  merchant: z.string().trim().max(100),
  branch: z.string().trim().max(60).default(""), // sucursal opcional
  notes: z.string().trim().max(500),
  templateId: z.union([z.uuid(), z.literal("")]).default(""),
  // Factura subida en el formulario (solo al crear).
  receiptId: z.union([z.uuid(), z.literal("")]).default(""),
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

  const isTransfer = input.type === "TRANSFER";
  if (isTransfer && !input.toAccountId) return { error: "Elige a qué cuenta pasa el dinero." };
  if (isTransfer && input.toAccountId === input.accountId) {
    return { error: "La cuenta de origen y la de destino deben ser distintas." };
  }

  // Las cuentas, la categoría y el gasto fijo tienen que ser del mismo espacio
  // (y la categoría, del mismo tipo). Las transferencias no llevan categoría ni gasto fijo.
  const [account, toAccount, category, template] = await Promise.all([
    db.account.findFirst({ where: { id: input.accountId, workspaceId } }),
    isTransfer ? db.account.findFirst({ where: { id: input.toAccountId, workspaceId } }) : null,
    !isTransfer && input.categoryId
      ? db.category.findFirst({
          where: { id: input.categoryId, workspaceId, type: input.type },
        })
      : null,
    !isTransfer && input.templateId
      ? db.transactionTemplate.findFirst({ where: { id: input.templateId, workspaceId } })
      : null,
  ]);
  if (!account) return { error: "Elige una cuenta válida." };
  if (isTransfer && !toAccount) return { error: "Elige una cuenta de destino válida." };
  if (!isTransfer && input.categoryId && !category) return { error: "Elige una categoría válida." };

  const data = {
    type: input.type,
    amountCents,
    currency: account.currency,
    date,
    accountId: account.id,
    toAccountId: toAccount?.id ?? null,
    categoryId: category?.id ?? null,
    merchant: input.merchant || null,
    branch: isTransfer ? null : cleanBranch(input.branch),
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
    const created = await db.transaction.create({
      data: { ...data, workspaceId, createdById: profile.id },
    });
    if (input.receiptId) {
      // Solo una factura del mismo espacio que aún no esté en otro movimiento.
      const { count } = await db.receipt.updateMany({
        where: { id: input.receiptId, workspaceId, transactionId: null },
        data: { transactionId: created.id, status: "CONFIRMED" },
      });
      // Si la IA leyó productos, seguimos a guardar sus precios en el comparador.
      const receipt = count > 0 ? await db.receipt.findUnique({ where: { id: input.receiptId } }) : null;
      const items = (receipt?.extractedData as { items?: unknown[] } | null)?.items;
      if (receipt && !receipt.itemsSavedAt && items && items.length > 0) {
        redirect(`/facturas/${receipt.id}?desde=movimiento`);
      }
    }
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
