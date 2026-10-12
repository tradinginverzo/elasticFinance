import { ListIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, DetailList } from "@/components/detail";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_LABELS, getAccountsWithBalance } from "@/lib/accounts";
import { requireWorkspace } from "@/lib/context";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuenta" };

// Ficha de solo lectura de una cuenta. Para cambiarla: botón "Editar".
export default async function AccountPage({ params }: PageProps<"/cuentas/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  // Solo cuentas del espacio activo: así nunca se muestra una cuenta de otro espacio.
  const account = (await getAccountsWithBalance(workspace.id)).find((a) => a.id === id);
  if (!account) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <DetailHeader
        backHref="/cuentas"
        backLabel="Cuentas"
        title={account.name}
        subtitle={ACCOUNT_TYPE_LABELS[account.type]}
        editHref={`/cuentas/${account.id}/editar`}
      >
        <p className="mt-3 text-sm text-muted-foreground">Saldo actual</p>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            account.balanceCents < BigInt(0) && "text-expense",
          )}
        >
          {formatCents(account.balanceCents, account.currency)}
        </p>
      </DetailHeader>

      <DetailList
        rows={[
          { label: "Tipo", value: ACCOUNT_TYPE_LABELS[account.type] },
          { label: "Saldo inicial", value: formatCents(account.initialBalanceCents, account.currency) },
          { label: "Movimientos", value: String(account.transactionCount) },
          { label: "Moneda", value: account.currency },
        ]}
      />

      <Button
        variant="outline"
        className="h-10"
        render={<Link href={`/movimientos?cuenta=${account.id}`} />}
        nativeButton={false}
      >
        <ListIcon />
        Ver movimientos de esta cuenta
      </Button>
    </div>
  );
}
