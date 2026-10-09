import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import type { ProductReference } from "@/lib/price-compare";
import { getProductReferences, getStores } from "@/lib/prices";

import { type ListItem, ShoppingView } from "./shopping-view";

export const metadata = { title: "Lista de compras" };

export default async function ShoppingListPage({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const list = await db.shoppingList.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      items: {
        include: { product: true, priceEntry: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!list) notFound();

  const [stores, products, references] = await Promise.all([
    getStores(workspace.id),
    db.product.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    getProductReferences(
      workspace.id,
      list.items.map((i) => i.productId),
    ),
  ]);

  const items: ListItem[] = list.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    name: i.product.name,
    unit: i.product.unit,
    note: i.note,
    quantity: i.quantity,
    checked: i.checkedAt !== null,
    price: i.priceEntry
      ? {
          brand: i.priceEntry.brand,
          sizeEach: i.priceEntry.sizeEach,
          packCount: i.priceEntry.packCount,
          priceCents: Number(i.priceEntry.priceCents),
          regularPriceCents: i.priceEntry.regularPriceCents === null ? null : Number(i.priceEntry.regularPriceCents),
          onSale: i.priceEntry.onSale,
        }
      : null,
  }));

  return (
    <ShoppingView
      list={{ id: list.id, name: list.name, storeId: list.storeId, completed: list.completedAt !== null }}
      items={items}
      stores={stores}
      products={products}
      references={Object.fromEntries(references) as Record<string, ProductReference>}
      currency={workspace.currency}
    />
  );
}
