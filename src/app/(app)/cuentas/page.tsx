import { ChevronRightIcon, PlusIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACCOUNT_TYPE_LABELS, getAccountsWithBalance } from "@/lib/accounts";
import { requireWorkspace } from "@/lib/context";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuentas" };

export default async function AccountsPage() {
  const { workspace } = await requireWorkspace();
  const accounts = await getAccountsWithBalance(workspace.id);
  const total = accounts.reduce((sum, a) => sum + a.balanceCents, BigInt(0));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Saldo total en {workspace.name}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCents(total, workspace.currency)}
            </span>
          </p>
        </div>
        <Button render={<Link href="/cuentas/nueva" />} nativeButton={false} className="h-9">
          <PlusIcon />
          Nueva
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <WalletIcon className="size-6" />
            </span>
            <div>
              <p className="font-medium">Crea tu primera cuenta</p>
              <p className="text-sm text-muted-foreground">
                Por ejemplo tu efectivo, tu cuenta del banco o tu tarjeta de crédito.
              </p>
            </div>
            <Button render={<Link href="/cuentas/nueva" />} nativeButton={false}>
              Crear cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <ul className="divide-y">
            {accounts.map((account) => (
              <li key={account.id}>
                <Link
                  href={`/cuentas/${account.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[account.type]} · {account.transactionCount} movimientos
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      account.balanceCents < BigInt(0) && "text-expense",
                    )}
                  >
                    {formatCents(account.balanceCents, account.currency)}
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
