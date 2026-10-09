"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/context";
import { parseDateInput, todayInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { type PriceDraft, parseDraft } from "@/lib/price-draft";
import { findOrCreateStore, resolvePickedProduct } from "@/lib/prices";
import type { ProductUnit } from "@/lib/units";

type Result = { error: string | null };

async function findList(listId: string) {
  const { profile, workspace } = await requireWorkspace();
  const list = await db.shoppingList.findFirst({ where: { id: listId, workspaceId: workspace.id } });
  return { profile, workspace, list };
}

async function findItem(itemId: string) {
  const { profile, workspace } = await requireWorkspace();
  const item = await db.shoppingListItem.findFirst({
    where: { id: itemId, list: { workspaceId: workspace.id } },
    include: { list: true, product: true },
  });
  return { profile, workspace, item };
}

function refresh(listId: string) {
  revalidatePath(`/compras/${listId}`);
  revalidatePath("/compras");
}

export async function createList(): Promise<Result> {
  const { profile, workspace } = await requireWorkspace();
  const today = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date());
  // Sugerimos el supermercado de la última lista.
  const last = await db.shoppingList.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: { storeId: true },
  });
  const list = await db.shoppingList.create({
    data: { workspaceId: workspace.id, createdById: profile.id, name: `Compras ${today}`, storeId: last?.storeId ?? null },
  });
  redirect(`/compras/${list.id}`);
}

export async function renameList(listId: string, name: string): Promise<Result> {
  const { list } = await findList(listId);
  const clean = name.trim().slice(0, 60);
  if (!list) return { error: "Esa lista no existe." };
  if (!clean) return { error: "Escribe un nombre." };
  await db.shoppingList.update({ where: { id: list.id }, data: { name: clean } });
  refresh(list.id);
  return { error: null };
}

export async function deleteList(listId: string): Promise<Result> {
  const { list } = await findList(listId);
  if (!list) return { error: "Esa lista no existe." };
  // Los precios anotados se quedan en el comparador.
  await db.shoppingList.delete({ where: { id: list.id } });
  revalidatePath("/compras");
  redirect("/compras");
}

export async function setListCompleted(listId: string, completed: boolean): Promise<Result> {
  const { list } = await findList(listId);
  if (!list) return { error: "Esa lista no existe." };
  await db.shoppingList.update({ where: { id: list.id }, data: { completedAt: completed ? new Date() : null } });
  refresh(list.id);
  return { error: null };
}

// Dónde se está comprando. Los precios ya anotados en esta lista pasan a ese supermercado.
export async function setListStore(listId: string, storeId: string, newStoreName: string): Promise<Result> {
  const { workspace, list } = await findList(listId);
  if (!list) return { error: "Esa lista no existe." };
  const store = storeId
    ? await db.store.findFirst({ where: { id: storeId, workspaceId: workspace.id } })
    : newStoreName.trim()
      ? await findOrCreateStore(workspace.id, newStoreName.slice(0, 60))
      : null;
  if (!store) return { error: "Elige el supermercado." };

  await db.$transaction([
    db.shoppingList.update({ where: { id: list.id }, data: { storeId: store.id } }),
    db.priceEntry.updateMany({
      where: { shoppingItem: { listId: list.id } },
      data: { storeId: store.id },
    }),
  ]);
  refresh(list.id);
  return { error: null };
}

export async function addItem(
  listId: string,
  picked: { id: string } | { name: string; unit: ProductUnit },
): Promise<Result> {
  const { workspace, list } = await findList(listId);
  if (!list) return { error: "Esa lista no existe." };
  const product = await resolvePickedProduct(workspace.id, picked);
  if (!product) return { error: "Escribe un nombre de producto válido." };
  await db.shoppingListItem.create({ data: { listId: list.id, productId: product.id } });
  refresh(list.id);
  return { error: null };
}

export async function removeItem(itemId: string): Promise<Result> {
  const { item } = await findItem(itemId);
  if (!item) return { error: "Ese producto ya no está en la lista." };
  // El precio anotado al marcarlo era de esta compra: se va con él.
  await db.$transaction([
    db.shoppingListItem.delete({ where: { id: item.id } }),
    ...(item.priceEntryId ? [db.priceEntry.delete({ where: { id: item.priceEntryId } })] : []),
  ]);
  refresh(item.listId);
  return { error: null };
}

// Al carrito: con el precio que se ve en la percha (o sin precio).
export async function markItem(
  itemId: string,
  input: { quantity: number; note: string; draft: PriceDraft | null },
): Promise<Result> {
  const { profile, workspace, item } = await findItem(itemId);
  if (!item) return { error: "Ese producto ya no está en la lista." };
  const quantity = Math.round(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: "La cantidad no es válida." };
  const note = input.note.trim().slice(0, 100) || null;

  let priceEntryId = item.priceEntryId;
  if (input.draft) {
    if (!item.list.storeId) return { error: "Primero elige en qué supermercado estás." };
    const price = parseDraft(input.draft, item.product.unit);
    if ("error" in price) return price;
    const data = {
      ...price,
      priceCents: BigInt(price.priceCents),
      regularPriceCents: price.regularPriceCents === null ? null : BigInt(price.regularPriceCents),
      storeId: item.list.storeId,
    };
    if (priceEntryId) {
      await db.priceEntry.update({ where: { id: priceEntryId }, data });
    } else {
      const entry = await db.priceEntry.create({
        data: {
          ...data,
          workspaceId: workspace.id,
          productId: item.productId,
          createdById: profile.id,
          source: "SHOPPING",
          date: parseDateInput(todayInput())!,
        },
      });
      priceEntryId = entry.id;
    }
  } else if (priceEntryId) {
    // Marcado sin precio: si tenía uno, se quita.
    await db.priceEntry.delete({ where: { id: priceEntryId } });
    priceEntryId = null;
  }

  await db.shoppingListItem.update({
    where: { id: item.id },
    data: { quantity, note, priceEntryId, checkedAt: item.checkedAt ?? new Date() },
  });
  refresh(item.listId);
  return { error: null };
}

// Sacar del carrito: vuelve a pendiente y se borra el precio anotado.
export async function uncheckItem(itemId: string): Promise<Result> {
  const { item } = await findItem(itemId);
  if (!item) return { error: "Ese producto ya no está en la lista." };
  await db.$transaction([
    db.shoppingListItem.update({ where: { id: item.id }, data: { checkedAt: null, priceEntryId: null } }),
    ...(item.priceEntryId ? [db.priceEntry.delete({ where: { id: item.priceEntryId } })] : []),
  ]);
  refresh(item.listId);
  return { error: null };
}
