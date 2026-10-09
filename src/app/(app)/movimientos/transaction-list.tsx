import { ArrowLeftRightIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";

import { CategoryBadge } from "@/components/category-badge";
import { UsualDiffBadge } from "@/components/usual-diff-badge";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { profileNameSelect, shortName } from "@/lib/profile-name";
import { cn } from "@/lib/utils";

export type TransactionListItem = {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amountCents: bigint;
  currency: string;
  date: Date;
  merchant: string | null;
  branch: string | null;
  templateAmountCents: bigint | null;
  category: { name: string; color: string | null } | null;
  account: { name: string };
  toAccount: { name: string } | null; // solo transferencias
  createdBy: { firstName: string | null; lastName: string | null; email: string };
  _count: { receipts: number };
};

// Lista de movimientos agrupada por día. `showAuthor` en espacios compartidos.
// Sin agrupar (p. ej. ordenada por monto), cada fila muestra su fecha.
export function TransactionList({
  transactions,
  showAuthor = false,
  groupByDay = true,
}: {
  transactions: TransactionListItem[];
  showAuthor?: boolean;
  groupByDay?: boolean;
}) {
  if (!groupByDay) {
    return (
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {transactions.map((t) => (
          <TransactionRow key={t.id} t={t} showAuthor={showAuthor} showDate />
        ))}
      </ul>
    );
  }

  const groups = new Map<string, TransactionListItem[]>();
  for (const t of transactions) {
    const key = t.date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="flex flex-col gap-1">
          <h3 className="px-1 text-xs font-medium text-muted-foreground first-letter:uppercase">
            {formatDate(items[0].date, { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((t) => (
              <TransactionRow key={t.id} t={t} showAuthor={showAuthor} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type RowProps = { t: TransactionListItem; showAuthor: boolean; showDate?: boolean };

function TransactionRow(props: RowProps) {
  return (
    <li>
      <Link href={`/movimientos/${props.t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
        {props.t.type === "TRANSFER" ? <TransferRow {...props} /> : <FlowRow {...props} />}
      </Link>
    </li>
  );
}

const shortDate = (date: Date) => formatDate(date, { day: "numeric", month: "short" });

// Gasto o ingreso: insignia de categoría, monto con signo y color.
function FlowRow({ t, showAuthor, showDate = false }: RowProps) {
  const type = t.type === "INCOME" ? "INCOME" : "EXPENSE";
  return (
    <>
      <CategoryBadge name={t.category?.name ?? null} color={t.category?.color ?? null} className="size-8 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          <span className="truncate">
            {t.merchant || t.category?.name || (type === "EXPENSE" ? "Gasto" : "Ingreso")}
            {t.merchant && t.branch && <span className="font-normal text-muted-foreground"> · {t.branch}</span>}
          </span>
          <ReceiptMark count={t._count.receipts} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            showDate ? shortDate(t.date) : null,
            t.merchant ? t.category?.name : null,
            t.account.name,
            showAuthor ? shortName(t.createdBy) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            "font-semibold whitespace-nowrap tabular-nums",
            type === "EXPENSE" ? "text-expense" : "text-income",
          )}
        >
          {type === "EXPENSE" ? "−" : "+"}
          {formatCents(t.amountCents, t.currency)}
        </span>
        {/* Gasto/ingreso fijo con un monto distinto del habitual. */}
        <UsualDiffBadge
          type={type}
          amountCents={Number(t.amountCents)}
          usualCents={t.templateAmountCents === null ? null : Number(t.templateAmountCents)}
          currency={t.currency}
        />
      </div>
    </>
  );
}

// Transferencia: "Chibuleo → Efectivo", monto neutro (no es ingreso ni gasto).
function TransferRow({ t, showAuthor, showDate = false }: RowProps) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ArrowLeftRightIcon className="size-4" />
        <span className="sr-only">Transferencia</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          <span className="truncate">
            {t.account.name} → {t.toAccount?.name ?? "—"}
          </span>
          <ReceiptMark count={t._count.receipts} />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[showDate ? shortDate(t.date) : null, "Transferencia", t.merchant, showAuthor ? shortName(t.createdBy) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className="font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
        {formatCents(t.amountCents, t.currency)}
      </span>
    </>
  );
}

// Clip junto al nombre si el movimiento tiene factura.
function ReceiptMark({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Con factura" />
  );
}

export const transactionListInclude = {
  category: { select: { name: true, color: true } },
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  createdBy: { select: profileNameSelect },
  _count: { select: { receipts: true } },
} as const;
