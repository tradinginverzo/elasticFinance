import { CalendarIcon, ChevronRightIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatAmount } from "@/lib/money";
import { getProductReferences } from "@/lib/prices";
import { itemEstimate } from "@/lib/shopping-estimate";

import { NewListButton } from "./new-list-button";

export const metadata = { title: "Compras" };

export default async function ShoppingListsPage() {
  const { workspace } = await requireWorkspace();
  const lists = await db.shoppingList.findMany({
    where: { workspaceId: workspace.id },
    include: {
      store: { select: { name: true } },
      items: {
        select: {
          productId: true,
          quantity: true,
          estimateCents: true,
          checkedAt: true,
          priceEntry: { select: { priceCents: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const references = await getProductReferences(
    workspace.id,
    [...new Set(lists.flatMap((l) => l.items.map((i) => i.productId)))],
  );

  const rows = lists.map((l) => {
    // Estimado de la lista (o lo real, para lo que ya se compró con precio).
    let total = 0;
    for (const i of l.items) {
      const estimate = itemEstimate(
        i.estimateCents === null ? null : Number(i.estimateCents),
        references.get(i.productId),
        l.storeId,
      ).cents;
      const cents = i.priceEntry ? Number(i.priceEntry.priceCents) : estimate;
      if (cents !== null) total += cents * i.quantity;
    }
    return {
      id: l.id,
      name: l.name,
      storeName: l.store?.name ?? null,
      branch: l.branch,
      plannedDate: l.plannedDate,
      completed: l.completedAt !== null,
      count: l.items.length,
      checked: l.items.filter((i) => i.checkedAt).length,
      total,
    };
  });
  // Las que están en curso: primero las de fecha más cercana; las sin fecha, al final.
  const active = rows
    .filter((l) => !l.completed)
    .sort((a, b) => (a.plannedDate?.getTime() ?? Infinity) - (b.plannedDate?.getTime() ?? Infinity));
  const done = rows.filter((l) => l.completed);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">Planifica en casa y anota los precios en el súper.</p>
        </div>
        <NewListButton />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingCartIcon className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea una lista con lo que vas a comprar y ve cuánto te costará aproximadamente. Cuando vayas al súper,
              ábrela, anota los precios y te dirá si es el mejor precio y si coincide con lo que estimaste.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ListSection title="Pendientes" lists={active} currency={workspace.currency} />
          <ListSection title="Terminadas" lists={done} currency={workspace.currency} />
        </>
      )}
    </div>
  );
}

function ListSection({
  title,
  lists,
  currency,
}: {
  title: string;
  lists: {
    id: string;
    name: string;
    storeName: string | null;
    branch: string | null;
    plannedDate: Date | null;
    completed: boolean;
    count: number;
    checked: number;
    total: number;
  }[];
  currency: string;
}) {
  if (lists.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {lists.map((l) => (
          <li key={l.id}>
            <Link href={`/compras/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  {l.plannedDate && !l.completed && (
                    <>
                      <CalendarIcon className="size-3 shrink-0" />
                      {formatDate(l.plannedDate, { weekday: "short", day: "numeric", month: "short" })} (tentativo) ·{" "}
                    </>
                  )}
                  {[
                    l.storeName ? `${l.storeName}${l.branch ? ` · ${l.branch}` : ""}` : null,
                    l.checked > 0 && !l.completed ? `${l.checked} de ${l.count} en el carrito` : `${l.count} productos`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="text-right">
                <span className="block text-xs text-muted-foreground">{l.completed ? "Total" : "Estimado"}</span>
                <span className="block font-semibold tabular-nums">{formatAmount(l.total, currency)}</span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
