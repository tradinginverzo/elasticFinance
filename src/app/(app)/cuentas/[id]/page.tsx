import { notFound } from "next/navigation";

import { getAccountsWithBalance } from "@/lib/accounts";
import { requireWorkspace } from "@/lib/context";
import { centsToInput, formatCents } from "@/lib/money";

import { AccountForm } from "../account-form";

export const metadata = { title: "Editar cuenta" };

export default async function EditAccountPage({ params }: PageProps<"/cuentas/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  // Solo cuentas del espacio activo: así nunca se muestra una cuenta de otro espacio.
  const account = (await getAccountsWithBalance(workspace.id)).find((a) => a.id === id);
  if (!account) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
        <p className="text-sm text-muted-foreground">
          Saldo actual:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCents(account.balanceCents, account.currency)}
          </span>
        </p>
      </div>
      <AccountForm
        currency={account.currency}
        account={{
          id: account.id,
          name: account.name,
          type: account.type,
          initialBalance: centsToInput(account.initialBalanceCents),
          transactionCount: account.transactionCount,
        }}
      />
    </div>
  );
}
