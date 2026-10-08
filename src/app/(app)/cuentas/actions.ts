"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isMemberOf, requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";

export type AccountFormState = { error: string | null };

const accountSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la cuenta.").max(60),
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "SAVINGS"]),
  initialBalance: z.string().trim(),
});

// Saldo inicial: admite negativo (p. ej. deuda de una tarjeta de crédito) y vacío (= 0).
function parseBalance(value: string) {
  if (value === "") return BigInt(0);
  const negative = value.startsWith("-");
  const cents = parseAmountToCents(negative ? value.slice(1) : value);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

// accountId = null → crear; si no, editar esa cuenta.
export async function saveAccount(
  accountId: string | null,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const { profile, workspace } = await requireWorkspace();

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const initialBalanceCents = parseBalance(parsed.data.initialBalance);
  if (initialBalanceCents === null) return { error: "El saldo inicial no es un monto válido." };

  const data = {
    name: parsed.data.name,
    type: parsed.data.type,
    initialBalanceCents,
  };

  if (accountId) {
    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account || !(await isMemberOf(profile.id, account.workspaceId))) {
      return { error: "Esa cuenta no existe." };
    }
    await db.account.update({ where: { id: accountId }, data });
  } else {
    await db.account.create({
      data: { ...data, workspaceId: workspace.id, currency: workspace.currency },
    });
  }

  redirect("/cuentas");
}

export async function deleteAccount(accountId: string): Promise<AccountFormState> {
  const { profile } = await requireWorkspace();
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { _count: { select: { transactions: true, incomingTransfers: true } } },
  });
  if (!account || !(await isMemberOf(profile.id, account.workspaceId))) {
    return { error: "Esa cuenta no existe." };
  }
  // Borrar la cuenta borraría sus movimientos (también las transferencias que recibió):
  // solo lo permitimos si está vacía.
  const count = account._count.transactions + account._count.incomingTransfers;
  if (count > 0) {
    return {
      error: `La cuenta tiene ${count} movimientos. Bórralos o muévelos antes de eliminarla.`,
    };
  }

  await db.account.delete({ where: { id: accountId } });
  redirect("/cuentas");
}
