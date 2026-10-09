import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PinIcon,
  PlusIcon,
  ReceiptIcon,
  ReceiptTextIcon,
} from "lucide-react";
import Link from "next/link";

import { FixedComparison } from "@/components/fixed-comparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatDate, formatMonth, monthRange, parseDateInput, shiftMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/form-options";
import { formatCents, parseAmountToCents } from "@/lib/money";

import { type Filters, filtersToParams, hasAnyFilter, parseFilters } from "./filters";
import { MovementFilters } from "./movement-filters";
import { TransactionList, transactionListInclude } from "./transaction-list";

// Como mucho se muestran estos movimientos (un rango de fechas largo podría traer miles).
const MAX_RESULTS = 500;

const ORDER_BY: Record<Filters["orden"], Prisma.TransactionOrderByWithRelationInput[]> = {
  fecha_desc: [{ date: "desc" }, { createdAt: "desc" }],
  fecha_asc: [{ date: "asc" }, { createdAt: "asc" }],
  monto_desc: [{ amountCents: "desc" }, { date: "desc" }],
  monto_asc: [{ amountCents: "asc" }, { date: "desc" }],
};

// Filtros → condiciones de la consulta.
function buildWhere(
  workspaceId: string,
  f: Filters,
  monthDates: { start: Date; end: Date },
): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [];
  const desde = f.desde ? parseDateInput(f.desde) : null;
  const hasta = f.hasta ? parseDateInput(f.hasta) : null;
  and.push(
    desde || hasta
      ? { date: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : { date: { gte: monthDates.start, lt: monthDates.end } },
  );
  if (f.tipo) and.push({ type: f.tipo });
  if (f.cat) and.push({ category: { name: f.cat } });
  // En transferencias cuenta tanto la cuenta de origen como la de destino.
  if (f.cuenta) and.push({ OR: [{ accountId: f.cuenta }, { toAccountId: f.cuenta }] });
  if (f.tipoCuenta) and.push({ OR: [{ account: { type: f.tipoCuenta } }, { toAccount: { type: f.tipoCuenta } }] });
  const min = f.min ? parseAmountToCents(f.min) : null;
  const max = f.max ? parseAmountToCents(f.max) : null;
  if (min !== null || max !== null) {
    and.push({ amountCents: { ...(min !== null ? { gte: min } : {}), ...(max !== null ? { lte: max } : {}) } });
  }
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { merchant: contains },
        { branch: contains },
        { notes: contains },
        { category: { name: contains } },
        { account: { name: contains } },
        { toAccount: { name: contains } },
      ],
    });
  }
  return { workspaceId, AND: and };
}

export const metadata = { title: "Movimientos" };

export default async function TransactionsPage({ searchParams }: PageProps<"/movimientos">) {
  const { workspace } = await requireWorkspace();
  const params = await searchParams;
  const { mes } = params;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonth();
  const filters = parseFilters(params);
  const filtered = hasAnyFilter(filters);
  const hasRange = Boolean(filters.desde || filters.hasta);

  // getFormOptions asegura además los colores de las insignias de categoría.
  const { accounts, categories } = await getFormOptions(workspace.id);
  const transactions = await db.transaction.findMany({
    where: buildWhere(workspace.id, filters, monthRange(month)),
    include: transactionListInclude,
    orderBy: ORDER_BY[filters.orden],
    take: MAX_RESULTS,
  });
  const monthHref = (m: string) => `/movimientos?${filtersToParams(filters, m).toString()}`;
  const day = (d: string) => formatDate(new Date(`${d}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric" });

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
            variant="outline"
            render={<Link href="/facturas" />}
            nativeButton={false}
            aria-label="Facturas"
            className="size-9 md:hidden"
          >
            <ReceiptIcon />
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

      <MovementFilters
        // Se remonta al cambiar los filtros desde fuera (etiquetas, meses): el buscador toma el valor nuevo.
        key={filtersToParams(filters).toString()}
        filters={filters}
        month={month}
        accounts={accounts}
        categories={categories}
      />

      {hasRange ? (
        <p className="text-center font-medium">
          {filters.desde && filters.hasta
            ? `Del ${day(filters.desde)} al ${day(filters.hasta)}`
            : filters.desde
              ? `Desde el ${day(filters.desde)}`
              : `Hasta el ${day(filters.hasta)}`}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mes anterior"
            render={<Link href={monthHref(shiftMonth(month, -1))} />}
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
              render={<Link href={monthHref(shiftMonth(month, 1))} />}
              nativeButton={false}
            >
              <ChevronRightIcon />
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Ingresos" value={formatCents(income, workspace.currency)} className="text-income" />
        <Stat label="Gastos" value={formatCents(expense, workspace.currency)} className="text-expense" />
        <Stat label="Balance" value={formatCents(income - expense, workspace.currency)} />
      </div>

      {!filtered && (
        <FixedComparison
          variant="month"
          income={Number(income)}
          expense={Number(expense)}
          currency={workspace.currency}
        />
      )}

      {filtered && transactions.length > 0 && (
        <p className="-mt-3 text-sm text-muted-foreground">
          {transactions.length === MAX_RESULTS
            ? `Se muestran los primeros ${MAX_RESULTS} movimientos. Ajusta los filtros para ver menos.`
            : transactions.length === 1
              ? "1 movimiento"
              : `${transactions.length} movimientos`}
        </p>
      )}

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptTextIcon className="size-6" />
            </span>
            {filtered ? (
              <>
                <p className="text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
                <Button variant="outline" render={<Link href={`/movimientos?mes=${month}`} />} nativeButton={false}>
                  Quitar filtros
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No hay movimientos este mes.</p>
                <Button render={<Link href="/movimientos/nuevo" />} nativeButton={false}>
                  Registrar movimiento
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <TransactionList
          transactions={transactions}
          showAuthor={workspace.kind === "SHARED"}
          // Ordenados por monto, agrupar por día no tiene sentido: lista corrida con la fecha en cada fila.
          groupByDay={filters.orden.startsWith("fecha")}
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
