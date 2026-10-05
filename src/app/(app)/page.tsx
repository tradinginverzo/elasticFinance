import { ChevronRightIcon, PlusIcon, ReceiptTextIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountsWithBalance } from "@/lib/accounts";
import { getCategories } from "@/lib/categories";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatMonth, monthRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { shortName } from "@/lib/profile-name";
import { cn } from "@/lib/utils";

import { TransactionList, transactionListInclude } from "./movimientos/transaction-list";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const { profile, workspace } = await requireWorkspace();
  const month = currentMonth();
  const { start, end } = monthRange(month);

  await getCategories(workspace.id); // asegura los colores de las insignias de categoría
  const [accounts, totals, recent] = await Promise.all([
    getAccountsWithBalance(workspace.id),
    db.transaction.groupBy({
      by: ["type"],
      where: { workspaceId: workspace.id, date: { gte: start, lt: end } },
      _sum: { amountCents: true },
    }),
    db.transaction.findMany({
      where: { workspaceId: workspace.id },
      include: transactionListInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const sum = (type: "INCOME" | "EXPENSE") =>
    totals.find((t) => t.type === type)?._sum.amountCents ?? BigInt(0);
  const income = sum("INCOME");
  const expense = sum("EXPENSE");
  const totalBalance = accounts.reduce((s, a) => s + a.balanceCents, BigInt(0));
  const currency = workspace.currency;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {shortName(profile)}</h1>
          <p className="text-sm text-muted-foreground">{workspace.name}</p>
        </div>
        <Button
          render={<Link href="/movimientos/nuevo" />}
          nativeButton={false}
          className="hidden h-9 sm:inline-flex"
        >
          <PlusIcon />
          Nuevo movimiento
        </Button>
      </div>

      {!profile.firstName && (
        <Link
          href="/perfil"
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10"
        >
          <UserRoundIcon className="size-5 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="font-medium">Completa tu perfil.</span> Añade tu nombre para que
            aparezca en la app y en los espacios compartidos.
          </span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Link>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo total</p>
            <p
              className={cn(
                "text-3xl font-semibold tracking-tight tabular-nums",
                totalBalance < BigInt(0) && "text-expense",
              )}
            >
              {formatCents(totalBalance, currency)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t pt-4">
            <MonthStat label="Ingresos" value={formatCents(income, currency)} className="text-income" />
            <MonthStat label="Gastos" value={formatCents(expense, currency)} className="text-expense" />
            <MonthStat label="Balance" value={formatCents(income - expense, currency)} />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground first-letter:uppercase">{formatMonth(month)}</p>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptTextIcon className="size-6" />
            </span>
            <div>
              <p className="font-medium">Empieza creando tus cuentas</p>
              <p className="text-sm text-muted-foreground">
                Tu efectivo, tu banco o tu tarjeta. Después podrás registrar gastos e ingresos.
              </p>
            </div>
            <Button render={<Link href="/cuentas/nueva" />} nativeButton={false}>
              Crear cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="gap-0 pb-0">
            <CardHeader className="pb-3">
              <CardTitle>Cuentas</CardTitle>
            </CardHeader>
            <ul className="divide-y border-t">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate">{a.name}</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      a.balanceCents < BigInt(0) && "text-expense",
                    )}
                  >
                    {formatCents(a.balanceCents, a.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Últimos movimientos</h2>
              <Link
                href="/movimientos"
                className="flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                Ver todos <ChevronRightIcon className="size-4" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aún no hay movimientos. Toca <span className="font-medium">+</span> para registrar el
                primero.
              </p>
            ) : (
              <TransactionList transactions={recent} showAuthor={workspace.kind === "SHARED"} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate font-semibold tabular-nums", className)}>{value}</p>
    </div>
  );
}
