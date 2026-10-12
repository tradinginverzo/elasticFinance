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
import type { ChartSlice } from "@/components/share-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatDate, formatMonth, monthRange, parseDateInput, shiftMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/form-options";
import { FALLBACK_CATEGORY_COLOR } from "@/lib/category-colors";
import { formatAmount, formatCents, parseAmountToCents } from "@/lib/money";

import { CategoryCharts } from "./category-charts";
import { type Filters, filtersToParams, hasAnyFilter, parseFilters } from "./filters";
import { MovementFilters } from "./movement-filters";
import { TransactionList, transactionListInclude } from "./transaction-list";

// Sin filtros se ve un mes por página (como mucho estos movimientos, por seguridad).
const MAX_RESULTS = 500;
// Con filtros se pagina de 25 en 25 (dentro del mes que se ve, o del rango de fechas elegido).
const PAGE_SIZE = 25;

const ORDER_BY: Record<Filters["orden"], Prisma.TransactionOrderByWithRelationInput[]> = {
  fecha_desc: [{ date: "desc" }, { createdAt: "desc" }],
  fecha_asc: [{ date: "asc" }, { createdAt: "asc" }],
  monto_desc: [{ amountCents: "desc" }, { date: "desc" }],
  monto_asc: [{ amountCents: "asc" }, { date: "desc" }],
};

// En las tortas por categoría, las 7 más grandes van solas y el resto se junta en "Otras".
const MAX_SLICES = 8;

// Movimientos de un tipo → porciones por categoría (con el color de cada categoría, el mismo
// de su insignia en toda la app), de mayor a menor.
function byCategory(
  transactions: { type: string; amountCents: bigint; category: { name: string; color: string | null } | null }[],
  type: "EXPENSE" | "INCOME",
  currency: string,
): ChartSlice[] {
  const groups = new Map<string, ChartSlice>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const key = t.category?.name ?? "";
    const group = groups.get(key) ?? {
      key: key || "sin-categoria",
      label: key || "Sin categoría",
      value: 0,
      color: t.category ? (t.category.color ?? FALLBACK_CATEGORY_COLOR) : FALLBACK_CATEGORY_COLOR,
    };
    group.value += Number(t.amountCents);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;
  const rest = sorted.slice(MAX_SLICES - 1);
  return [
    ...sorted.slice(0, MAX_SLICES - 1),
    {
      key: "otras",
      label: `Otras (${rest.length})`,
      value: rest.reduce((s, x) => s + x.value, 0),
      color: "var(--muted-foreground)",
      detail: rest.map((x) => `${x.label} ${formatAmount(x.value, currency)}`).join(", "),
    },
  ];
}

// Filtros → condiciones de la consulta.
function buildWhere(
  workspaceId: string,
  f: Filters,
  monthDates: { start: Date; end: Date }, // el mes que se ve (si no se eligieron fechas)
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

  // El mes que se ve (o el rango de fechas elegido en los filtros). Con filtros, paginado.
  const where = buildWhere(workspace.id, filters, monthRange(month));

  // getFormOptions asegura además los colores de las insignias de categoría.
  // Totales y tortas se calculan sobre TODOS los resultados, no solo la página que se ve.
  const [{ accounts, categories }, count, totals, categoryTotals] = await Promise.all([
    getFormOptions(workspace.id),
    db.transaction.count({ where }),
    db.transaction.groupBy({ by: ["type"], where, _sum: { amountCents: true } }),
    db.transaction.groupBy({
      by: ["type", "categoryId"],
      where: { AND: [where, { type: { not: "TRANSFER" } }] },
      _sum: { amountCents: true },
    }),
  ]);
  const totalPages = filtered ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const requestedPage = Number(typeof params.pagina === "string" ? params.pagina : 1);
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const transactions = await db.transaction.findMany({
    where,
    include: transactionListInclude,
    orderBy: ORDER_BY[filters.orden],
    skip: filtered ? (page - 1) * PAGE_SIZE : 0,
    take: filtered ? PAGE_SIZE : MAX_RESULTS,
  });

  const monthHref = (m: string) => `/movimientos?${filtersToParams(filters, m).toString()}`;
  const pageHref = (p: number) => {
    const query = filtersToParams(filters, month);
    if (p > 1) query.set("pagina", String(p));
    return `/movimientos?${query.toString()}`;
  };
  const day = (d: string) => formatDate(new Date(`${d}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric" });

  const sum = (type: "INCOME" | "EXPENSE") => totals.find((t) => t.type === type)?._sum.amountCents ?? BigInt(0);
  const income = sum("INCOME");
  const expense = sum("EXPENSE");
  const isCurrentMonth = month === currentMonth();
  // Totales por categoría con su nombre y color (para las tortas).
  const categoryRows = categoryTotals.map((row) => {
    const category = categories.find((c) => c.id === row.categoryId);
    return {
      type: row.type,
      amountCents: row._sum.amountCents ?? BigInt(0),
      category: category ? { name: category.name, color: category.color } : null,
    };
  });

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
        // Se remonta solo si cambian los otros filtros, NUNCA al buscar: si no, el campo pierde el
        // foco mientras escribes (y en el iPhone se cierra el teclado).
        key={filtersToParams({ ...filters, q: "" }).toString()}
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

      <CategoryCharts
        expenses={byCategory(categoryRows, "EXPENSE", workspace.currency)}
        incomes={byCategory(categoryRows, "INCOME", workspace.currency)}
        currency={workspace.currency}
      />

      {filtered && count > 0 && (
        <p className="-mt-3 text-sm text-muted-foreground">
          {count === 1 ? "1 movimiento" : `${count} movimientos`}
          {totalPages > 1 &&
            ` · del ${(page - 1) * PAGE_SIZE + 1} al ${Math.min(page * PAGE_SIZE, count)} (página ${page} de ${totalPages})`}
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

      {/* Páginas de 25 (solo con filtros; sin filtros se pasa de mes con las flechas de arriba). */}
      {totalPages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Button variant="outline" className="h-10" render={<Link href={pageHref(page - 1)} />} nativeButton={false}>
              <ChevronLeftIcon />
              Anterior
            </Button>
          ) : (
            <Button variant="outline" className="h-10" disabled>
              <ChevronLeftIcon />
              Anterior
            </Button>
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" className="h-10" render={<Link href={pageHref(page + 1)} />} nativeButton={false}>
              Siguiente
              <ChevronRightIcon />
            </Button>
          ) : (
            <Button variant="outline" className="h-10" disabled>
              Siguiente
              <ChevronRightIcon />
            </Button>
          )}
        </nav>
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
