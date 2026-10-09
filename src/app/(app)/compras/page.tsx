import { ChevronRightIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";

import { NewListButton } from "./new-list-button";

export const metadata = { title: "Compras" };

export default async function ShoppingListsPage() {
  const { workspace } = await requireWorkspace();
  const lists = await db.shoppingList.findMany({
    where: { workspaceId: workspace.id },
    include: {
      store: { select: { name: true } },
      items: { select: { checkedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const active = lists.filter((l) => !l.completedAt);
  const done = lists.filter((l) => l.completedAt);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Anota los precios al llenar el carrito y te digo si es el mejor precio.
          </p>
        </div>
        <NewListButton />
      </div>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingCartIcon className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea una lista con lo que vas a comprar. En el súper, al tomar cada producto, escribe su precio: verás
              al momento si en otro supermercado sale más barato.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ListSection title="En curso" lists={active} />
          <ListSection title="Terminadas" lists={done} />
        </>
      )}
    </div>
  );
}

function ListSection({
  title,
  lists,
}: {
  title: string;
  lists: { id: string; name: string; store: { name: string } | null; items: { checkedAt: Date | null }[] }[];
}) {
  if (lists.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {lists.map((l) => {
          const checked = l.items.filter((i) => i.checkedAt).length;
          return (
            <li key={l.id}>
              <Link href={`/compras/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[l.store?.name, `${checked} de ${l.items.length} en el carrito`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
