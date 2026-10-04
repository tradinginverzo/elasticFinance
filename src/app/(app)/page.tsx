import { ReceiptTextIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { getActiveWorkspace } from "@/lib/workspaces";

export const metadata = { title: "Inicio" };

function startOfMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const workspace = await getActiveWorkspace(profile.id);

  const totals = await db.transaction.groupBy({
    by: ["type"],
    where: { workspaceId: workspace.id, date: { gte: startOfMonthUtc() } },
    _sum: { amountCents: true },
  });
  const sum = (type: "INCOME" | "EXPENSE") =>
    totals.find((t) => t.type === type)?._sum.amountCents ?? BigInt(0);
  const income = sum("INCOME");
  const expense = sum("EXPENSE");

  const monthName = new Intl.DateTimeFormat("es", { month: "long" }).format(
    new Date(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {profile.displayName ?? profile.email.split("@")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de {monthName} en {workspace.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Ingresos" value={formatCents(income, workspace.currency)} className="text-income" />
        <SummaryCard label="Gastos" value={formatCents(expense, workspace.currency)} className="text-expense" />
        <SummaryCard label="Balance" value={formatCents(income - expense, workspace.currency)} />
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ReceiptTextIcon className="size-6" />
          </span>
          <div>
            <p className="font-medium">Registra tu primer gasto</p>
            <p className="text-sm text-muted-foreground">
              Pronto podrás subir la foto de una factura y la IA rellenará los datos por ti.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
