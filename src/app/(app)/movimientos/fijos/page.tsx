import { CheckCircle2Icon, ChevronLeftIcon, CopyIcon, PinIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { FixedComparison } from "@/components/fixed-comparison";
import { UsualDiffBadge } from "@/components/usual-diff-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatDate, formatMonth } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { getTemplatesWithStatus } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gastos fijos" };

export default async function TemplatesPage() {
  const { workspace } = await requireWorkspace();
  const templates = await getTemplatesWithStatus(workspace.id);

  const expenses = templates.filter((t) => t.type === "EXPENSE");
  const incomes = templates.filter((t) => t.type === "INCOME");
  const monthlyFixed = expenses.reduce((s, t) => s + t.amountCents, BigInt(0));
  const monthlyFixedIncome = incomes.reduce((s, t) => s + t.amountCents, BigInt(0));
  const pending = templates.filter((t) => t.thisMonth.length === 0).length;
  const registeredCount = templates.length - pending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/movimientos"
          className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" /> Movimientos
        </Link>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Gastos fijos</h1>
          <div className="flex gap-2">
            {templates.length > 0 && (
              <Button
                variant="outline"
                render={<Link href="/movimientos/fijos/copiar" />}
                nativeButton={false}
                className="h-9"
                aria-label="Copiar a otro espacio"
              >
                <CopyIcon />
                <span className="hidden sm:inline">Copiar a otro espacio</span>
              </Button>
            )}
            <Button
              render={<Link href="/movimientos/fijos/nuevo" />}
              nativeButton={false}
              className="h-9"
            >
              <PlusIcon />
              Nuevo
            </Button>
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PinIcon className="size-6" />
            </span>
            <div>
              <p className="font-medium">Guarda tus gastos fijos</p>
              <p className="text-sm text-muted-foreground">
                Alquiler, luz, internet, colegio… y también ingresos como tu sueldo. Luego los
                registras cada mes con un toque.
              </p>
            </div>
            <Button render={<Link href="/movimientos/fijos/nuevo" />} nativeButton={false}>
              Crear gasto fijo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Gastos fijos al mes</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatCents(monthlyFixed, workspace.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {expenses.length} {expenses.length === 1 ? "gasto fijo" : "gastos fijos"}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:border-l sm:pl-5">
                <p className="text-sm text-muted-foreground">
                  Registrados en {formatMonth(currentMonth())}
                </p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {registeredCount}
                  <span className="text-lg font-normal text-muted-foreground"> de {templates.length}</span>
                </p>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={templates.length}
                  aria-valuenow={registeredCount}
                  aria-label="Gastos fijos registrados este mes"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(registeredCount / templates.length) * 100}%` }}
                  />
                </div>
                <p className={cn("text-xs", pending > 0 ? "font-medium text-foreground" : "text-income")}>
                  {pending === 0
                    ? "Todo registrado este mes"
                    : `Faltan ${pending} por registrar`}
                </p>
              </div>
              <div className="sm:col-span-2">
                <FixedComparison
                  income={Number(monthlyFixedIncome)}
                  expense={Number(monthlyFixed)}
                  currency={workspace.currency}
                />
              </div>
            </CardContent>
          </Card>

          <TemplateGroup title="Gastos" templates={expenses} currency={workspace.currency} />
          <TemplateGroup title="Ingresos" templates={incomes} currency={workspace.currency} />
        </>
      )}
    </div>
  );
}

function TemplateGroup({
  title,
  templates,
  currency,
}: {
  title: string;
  templates: Awaited<ReturnType<typeof getTemplatesWithStatus>>;
  currency: string;
}) {
  if (templates.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">{title}</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {templates.map((t) => {
          const registered = t.thisMonth[0];
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/movimientos/fijos/${t.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[formatCents(t.amountCents, currency), t.category?.name, t.account?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
              {registered ? (
                <Link
                  href={`/movimientos/${registered.id}`}
                  className="flex items-center gap-1.5 text-right text-xs text-muted-foreground"
                >
                  <CheckCircle2Icon className="size-4 text-income" />
                  <span className="flex flex-col items-end gap-0.5">
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        t.type === "EXPENSE" ? "text-expense" : "text-income",
                      )}
                    >
                      {formatCents(registered.amountCents, currency)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsualDiffBadge
                        type={t.type}
                        amountCents={Number(registered.amountCents)}
                        usualCents={Number(registered.templateAmountCents ?? t.amountCents)}
                        currency={currency}
                      />
                      {formatDate(registered.date)}
                    </span>
                  </span>
                </Link>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/movimientos/nuevo?fijo=${t.id}`} />}
                  nativeButton={false}
                >
                  Registrar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
