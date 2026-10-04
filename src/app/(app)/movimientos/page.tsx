import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PinIcon,
  PlusIcon,
  ReceiptTextIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatMonth, monthRange, shiftMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

import { TransactionList, transactionListInclude } from "./transaction-list";

export const metadata = { title: "Movimientos" };

export default async function TransactionsPage({ searchParams }: PageProps<"/movimientos">) {
  const { workspace } = await requireWorkspace();
  const { mes } = await searchParams;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonth();
  const { start, end } = monthRange(month);

  const transactions = await db.transaction.findMany({
    where: { workspaceId: workspace.id, date: { gte: start, lt: end } },
    include: transactionListInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const sum = (type: "INCOME" | "EXPENSE") =>
    transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amountCents, BigInt(0));
  const income = sum("INCOME");
  const expense = sum("EXPENSE");
  const isCurrentMonth = month === currentMonth();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/movimientos/fijos" />}
            nativeButton={false}
            className="h-9"
          >
            <PinIcon />
            Gastos fijos
          </Button>
          <Button
            render={<Link href="/movimientos/nuevo" />}
            nativeButton={false}
            className="hidden h-9 sm:inline-flex"
          >
            <PlusIcon />
            Nuevo
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mes anterior"
          render={<Link href={`/movimientos?mes=${shiftMonth(month, -1)}`} />}
          nativeButton={false}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="font-medium first-letter:uppercase">{formatMonth(month)}</span>
        {isCurrentMonth ? (
          <span className="size-8" />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes siguiente"
            render={<Link href={`/movimientos?mes=${shiftMonth(month, 1)}`} />}
            nativeButton={false}
          >
            <ChevronRightIcon />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Ingresos" value={formatCents(income, workspace.currency)} className="text-income" />
        <Stat label="Gastos" value={formatCents(expense, workspace.currency)} className="text-expense" />
        <Stat label="Balance" value={formatCents(income - expense, workspace.currency)} />
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptTextIcon className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">No hay movimientos este mes.</p>
            <Button render={<Link href="/movimientos/nuevo" />} nativeButton={false}>
              Registrar movimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TransactionList
          transactions={transactions}
          showAuthor={workspace.kind === "SHARED"}
        />
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`truncate text-sm font-semibold tabular-nums sm:text-base ${className ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
