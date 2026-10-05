import Link from "next/link";

import { CategoryBadge } from "@/components/category-badge";
import { UsualDiffBadge } from "@/components/usual-diff-badge";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { profileNameSelect, shortName } from "@/lib/profile-name";
import { cn } from "@/lib/utils";

export type TransactionListItem = {
  id: string;
  type: "EXPENSE" | "INCOME";
  amountCents: bigint;
  currency: string;
  date: Date;
  merchant: string | null;
  templateAmountCents: bigint | null;
  category: { name: string; color: string | null } | null;
  account: { name: string };
  createdBy: { firstName: string | null; lastName: string | null; email: string };
};

// Lista de movimientos agrupada por día. `showAuthor` en espacios compartidos.
export function TransactionList({
  transactions,
  showAuthor = false,
}: {
  transactions: TransactionListItem[];
  showAuthor?: boolean;
}) {
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
              <li key={t.id}>
                <Link
                  href={`/movimientos/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <CategoryBadge
                    name={t.category?.name ?? null}
                    color={t.category?.color ?? null}
                    className="size-8 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.merchant || t.category?.name || (t.type === "EXPENSE" ? "Gasto" : "Ingreso")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
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
                        t.type === "EXPENSE" ? "text-expense" : "text-income",
                      )}
                    >
                      {t.type === "EXPENSE" ? "−" : "+"}
                      {formatCents(t.amountCents, t.currency)}
                    </span>
                    {/* Gasto/ingreso fijo con un monto distinto del habitual. */}
                    <UsualDiffBadge
                      type={t.type}
                      amountCents={Number(t.amountCents)}
                      usualCents={t.templateAmountCents === null ? null : Number(t.templateAmountCents)}
                      currency={t.currency}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export const transactionListInclude = {
  category: { select: { name: true, color: true } },
  account: { select: { name: true } },
  createdBy: { select: profileNameSelect },
} as const;
