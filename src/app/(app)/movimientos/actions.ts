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
  // Opcionales en gastos y transferencias: se guardan como movimientos aparte (categorías
  // "Comisión" e "IVA"), ligados a este.
  commission: z.string().trim().default(""),
  tax: z.string().trim().default(""),
});

const CHARGE_CATEGORY = { COMMISSION: "Comisión", TAX: "IVA" } as const;

// Categoría de gasto "Comisión" o "IVA" del espacio (sin distinguir tildes de más/menos); la crea si falta.
async function chargeCategory(workspaceId: string, kind: keyof typeof CHARGE_CATEGORY) {
  const names = kind === "COMMISSION" ? ["Comisión", "Comision"] : ["IVA"];
  const existing = await db.category.findFirst({
    where: { workspaceId, type: "EXPENSE", OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
  });
  return existing ?? db.category.create({ data: { workspaceId, name: CHARGE_CATEGORY[kind], type: "EXPENSE" } });
}

// Crea, actualiza o borra la comisión y el IVA de un movimiento (null = no tiene).
async function syncCharges(
  parent: {
    id: string;
    workspaceId: string;
    createdById: string;
    accountId: string;
    currency: string;
    date: Date;
  },
  label: string,
  amounts: Record<keyof typeof CHARGE_CATEGORY, bigint | null>,
) {
  const existing = await db.transaction.findMany({ where: { parentId: parent.id } });
  for (const kind of ["COMMISSION", "TAX"] as const) {
    const current = existing.find((t) => t.chargeType === kind);
    const amountCents = amounts[kind];
    if (!amountCents) {
      if (current) await db.transaction.delete({ where: { id: current.id } });
      continue;
    }
    const category = await chargeCategory(parent.workspaceId, kind);
    const data = {
      type: "EXPENSE" as const,
      amountCents,
      currency: parent.currency,
      date: parent.date,
      accountId: parent.accountId, // en transferencias, la cuenta de origen
      categoryId: category.id,
      merchant: `${CHARGE_CATEGORY[kind]} · ${label}`.slice(0, 100),
    };
    if (current) {
      await db.transaction.update({ where: { id: current.id }, data });
    } else {
      await db.transaction.create({
        data: {
          ...data,
          workspaceId: parent.workspaceId,
          createdById: parent.createdById,
          parentId: parent.id,
          chargeType: kind,
        },
      });
    }
  }
}

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

  // Comisión e IVA: solo en gastos y transferencias, y no en un movimiento que ya es una comisión/IVA.
  const allowsCharges = input.type !== "INCOME" && !existing?.parentId;
  const chargeAmount = (value: string, label: string) => {
    if (!allowsCharges || !value) return { cents: null };
    const cents = parseAmountToCents(value);
    if (cents === null || cents < BigInt(0)) return { error: `${label} no es válido. Ejemplo: 0,45` };
    return { cents: cents > BigInt(0) ? cents : null };
  };
  const commission = chargeAmount(input.commission, "El monto de la comisión");
  if ("error" in commission) return { error: commission.error ?? null };
  const tax = chargeAmount(input.tax, "El monto del IVA");
  if ("error" in tax) return { error: tax.error ?? null };
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
    // Con pagos parciales no se compara con el habitual: pagar una parte es lo normal.
    templateAmountCents: template && !template.allowPartial
      ? existing?.templateId === template.id && existing.templateAmountCents !== null
        ? existing.templateAmountCents
        : template.amountCents
      : null,
  };

  // Nombre para la comisión/IVA: "Comisión · Pago AMEX" o "Comisión · Chibuleo → AMEX".
  const chargeLabel =
    input.merchant || (isTransfer ? `${account.name} → ${toAccount?.name ?? ""}` : (category?.name ?? "Gasto"));

  if (transactionId) {
    const updated = await db.transaction.update({ where: { id: transactionId }, data });
    if (!existing?.parentId) {
      await syncCharges(updated, chargeLabel, { COMMISSION: commission.cents, TAX: tax.cents });
    }
  } else {
    const created = await db.transaction.create({
      data: { ...data, workspaceId, createdById: profile.id },
    });
    await syncCharges(created, chargeLabel, { COMMISSION: commission.cents, TAX: tax.cents });
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
