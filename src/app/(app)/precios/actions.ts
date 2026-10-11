"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireWorkspace } from "@/lib/context";
import { parseDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { type PriceDraft, parseDraft } from "@/lib/price-draft";
import { cleanBranch, cleanName, findOrCreateStore, resolvePickedProduct } from "@/lib/prices";

type Result = { error: string | null };

const unitSchema = z.enum(["ML", "G", "UNIT"]);

export async function createProduct(name: string, unit: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const parsedUnit = unitSchema.safeParse(unit);
  if (!name.trim()) return { error: "Escribe el nombre del producto." };
  if (!parsedUnit.success) return { error: "Elige cómo se mide." };
  const product = await resolvePickedProduct(workspace.id, { name, unit: parsedUnit.data });
  if (!product) return { error: "El nombre es demasiado largo." };
  redirect(`/precios/${product.id}`);
}

export async function updateProduct(productId: string, name: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const clean = cleanName(name);
  if (!clean || clean.length > 60) return { error: "Escribe un nombre (máx. 60 caracteres)." };
  const product = await db.product.findFirst({ where: { id: productId, workspaceId: workspace.id } });
  if (!product) return { error: "Ese producto no existe." };
  const taken = await db.product.findFirst({
    where: { workspaceId: workspace.id, name: { equals: clean, mode: "insensitive" }, NOT: { id: productId } },
  });
  if (taken) return { error: `Ya existe «${taken.name}».` };
  await db.product.update({ where: { id: productId }, data: { name: clean } });
  revalidatePath(`/precios/${productId}`);
  return { error: null };
}

export async function deleteProduct(productId: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const { count } = await db.product.deleteMany({ where: { id: productId, workspaceId: workspace.id } });
  if (count === 0) return { error: "Ese producto no existe." };
  redirect("/precios");
}

// Precio escrito a mano en el comparador.
export async function savePrice(input: {
  productId: string;
  storeId: string; // "" si es un supermercado nuevo
  newStoreName: string;
  branch: string; // opcional
  date: string;
  draft: PriceDraft;
}): Promise<Result> {
  const { profile, workspace } = await requireWorkspace();
  const product = await db.product.findFirst({ where: { id: input.productId, workspaceId: workspace.id } });
  if (!product) return { error: "Ese producto no existe." };

  const price = parseDraft(input.draft, product.unit);
  if ("error" in price) return price;
  const date = parseDateInput(input.date);
  if (!date) return { error: "La fecha no es válida." };

  const store = input.storeId
    ? await db.store.findFirst({ where: { id: input.storeId, workspaceId: workspace.id } })
    : input.newStoreName.trim()
      ? await findOrCreateStore(workspace.id, input.newStoreName.slice(0, 60))
      : null;
  if (!store) return { error: "Elige el supermercado." };

  await db.priceEntry.create({
    data: {
      ...price,
      priceCents: BigInt(price.priceCents),
      regularPriceCents: price.regularPriceCents === null ? null : BigInt(price.regularPriceCents),
      workspaceId: workspace.id,
      productId: product.id,
      storeId: store.id,
      branch: cleanBranch(input.branch),
      createdById: profile.id,
      source: "MANUAL",
      date,
    },
  });
  revalidatePath(`/precios/${product.id}`);
  revalidatePath("/precios");
  return { error: null };
}

export async function deletePrice(priceId: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const price = await db.priceEntry.findFirst({ where: { id: priceId, workspaceId: workspace.id } });
  if (!price) return { error: "Ese precio no existe." };
  await db.priceEntry.delete({ where: { id: price.id } });
  revalidatePath(`/precios/${price.productId}`);
  revalidatePath("/precios");
  return { error: null };
}

export async function renameStore(storeId: string, name: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const clean = cleanName(name);
  if (!clean || clean.length > 60) return { error: "Escribe un nombre (máx. 60 caracteres)." };
  const taken = await db.store.findFirst({
    where: { workspaceId: workspace.id, name: { equals: clean, mode: "insensitive" }, NOT: { id: storeId } },
  });
  if (taken) return { error: `Ya existe «${taken.name}».` };
  const { count } = await db.store.updateMany({ where: { id: storeId, workspaceId: workspace.id }, data: { name: clean } });
  if (count === 0) return { error: "Ese supermercado no existe." };
  revalidatePath("/precios", "layout");
  return { error: null };
}

// Borra el supermercado y todos sus precios.
export async function deleteStore(storeId: string): Promise<Result> {
  const { workspace } = await requireWorkspace();
  const { count } = await db.store.deleteMany({ where: { id: storeId, workspaceId: workspace.id } });
  if (count === 0) return { error: "Ese supermercado no existe." };
  revalidatePath("/precios", "layout");
  return { error: null };
}
