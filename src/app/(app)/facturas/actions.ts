"use server";

import { revalidatePath } from "next/cache";

import { isMemberOf, requireWorkspace } from "@/lib/context";
import { parseDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { type PriceDraft, parseDraft } from "@/lib/price-draft";
import { aliasText, cleanBranch, findOrCreateProduct, findOrCreateStore } from "@/lib/prices";
import type { ReceiptScan } from "@/lib/receipt-types";
import {
  deleteReceiptFiles,
  readReceipt,
  receiptReadingEnabled,
  startUpload,
  toReceiptScan,
} from "@/lib/receipts";
import type { ProductUnit } from "@/lib/units";

// Factura de un espacio al que pertenece el usuario (o null).
async function findOwnReceipt(receiptId: string) {
  const { profile } = await requireWorkspace();
  const receipt = await db.receipt.findUnique({
    where: { id: receiptId },
    include: { workspace: { select: { currency: true } } },
  });
  if (!receipt || !(await isMemberOf(profile.id, receipt.workspaceId))) return null;
  return receipt;
}

// 1) Registra la factura en el espacio activo y devuelve una URL firmada para subir el archivo.
export async function startReceiptUpload(mimeType: string, sizeBytes: number) {
  const { profile, workspace } = await requireWorkspace();
  return startUpload({ workspaceId: workspace.id, uploadedById: profile.id, mimeType, sizeBytes });
}

// 2) Ya subido el archivo: la IA lo lee y devuelve los datos para el formulario.
export async function scanReceipt(
  receiptId: string,
): Promise<{ scan: ReceiptScan | null; error: string | null; enabled: boolean }> {
  const receipt = await findOwnReceipt(receiptId);
  if (!receipt) return { scan: null, error: "Esa factura no existe.", enabled: false };
  const enabled = receiptReadingEnabled();

  const error = await readReceipt(receipt.id);
  const updated = await db.receipt.findUniqueOrThrow({ where: { id: receipt.id } });
  revalidatePath("/facturas");
  return {
    scan: await toReceiptScan(updated.extractedData, receipt.workspaceId, receipt.workspace.currency),
    error,
    enabled,
  };
}

// Adjunta una factura a un movimiento ya guardado (mismo espacio).
export async function attachReceipt(receiptId: string, transactionId: string): Promise<{ error: string | null }> {
  const receipt = await findOwnReceipt(receiptId);
  const transaction = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!receipt || !transaction || transaction.workspaceId !== receipt.workspaceId) {
    return { error: "No se pudo adjuntar la factura." };
  }
  await db.receipt.update({ where: { id: receipt.id }, data: { transactionId, status: "CONFIRMED" } });
  revalidatePath(`/movimientos/${transactionId}`);
  revalidatePath("/facturas");
  return { error: null };
}

// Borra la factura y su archivo. El movimiento (si lo tiene) y los productos no se tocan.
// Con `deletePrices`, también los precios que se guardaron desde ESTA factura.
export async function deleteReceipt(receiptId: string, deletePrices = false): Promise<{ error: string | null }> {
  const receipt = await findOwnReceipt(receiptId);
  if (!receipt) return { error: "Esa factura no existe." };
  await db.$transaction([
    ...(deletePrices ? [db.priceEntry.deleteMany({ where: { receiptId: receipt.id } })] : []),
    db.receipt.delete({ where: { id: receipt.id } }),
  ]);
  if (deletePrices) revalidatePath("/precios", "layout");
  await deleteReceiptFiles([receipt.storagePath]);
  if (receipt.transactionId) revalidatePath(`/movimientos/${receipt.transactionId}`);
  revalidatePath("/facturas");
  return { error: null };
}

export type ReceiptItemInput = {
  text: string;
  productId: string; // "" = producto nuevo
  newName: string;
  unit: ProductUnit;
  quantity: string;
  draft: PriceDraft;
};

// Guarda en el comparador los precios de los productos de la factura (reemplaza los de una
// vez anterior) y recuerda cómo se escribe cada producto en las facturas.
export async function saveReceiptItems(
  receiptId: string,
  input: { storeId: string; newStoreName: string; branch: string; date: string; items: ReceiptItemInput[] },
): Promise<{ error: string | null }> {
  const { profile, workspace } = await requireWorkspace();
  const receipt = await db.receipt.findFirst({ where: { id: receiptId, workspaceId: workspace.id } });
  if (!receipt) return { error: "Esa factura no es de este espacio." };
  if (input.items.length === 0) return { error: "Elige al menos un producto." };
  if (input.items.length > 300) return { error: "Demasiados productos." };

  const date = parseDateInput(input.date);
  if (!date) return { error: "La fecha no es válida." };
  const store = input.storeId
    ? await db.store.findFirst({ where: { id: input.storeId, workspaceId: workspace.id } })
    : input.newStoreName.trim()
      ? await findOrCreateStore(workspace.id, input.newStoreName.slice(0, 60))
      : null;
  if (!store) return { error: "Elige el supermercado." };

  // Valida todo antes de crear nada.
  const rows = [];
  for (const [i, item] of input.items.entries()) {
    const label = item.newName || item.text || `Producto ${i + 1}`;
    const product = item.productId
      ? await db.product.findFirst({ where: { id: item.productId, workspaceId: workspace.id } })
      : null;
    if (item.productId && !product) return { error: `${label}: el producto no existe.` };
    if (!product && !item.newName.trim()) return { error: `${label}: escribe el nombre del producto.` };
    const unit = product?.unit ?? item.unit;
    if (!["ML", "G", "UNIT"].includes(unit)) return { error: `${label}: elige cómo se mide.` };
    const price = parseDraft(item.draft, unit);
    if ("error" in price) return { error: `${label}: ${price.error}` };
    rows.push({ item, product, unit, price });
  }

  const entries = [];
  const aliases = new Map<string, { productId: string; brand: string | null; sizeEach: number; packCount: number }>();
  for (const { item, product, unit, price } of rows) {
    const target = product ?? (await findOrCreateProduct(workspace.id, item.newName.slice(0, 60), unit));
    entries.push({
      ...price,
      priceCents: BigInt(price.priceCents),
      regularPriceCents: price.regularPriceCents === null ? null : BigInt(price.regularPriceCents),
      workspaceId: workspace.id,
      productId: target.id,
      storeId: store.id,
      branch: cleanBranch(input.branch),
      createdById: profile.id,
      source: "RECEIPT" as const,
      receiptId: receipt.id,
      description: item.text.slice(0, 200) || null,
      date,
    });
    // Se recuerda también la marca y la medida: la próxima factura igual vendrá rellenada.
    if (item.text.trim()) {
      aliases.set(aliasText(item.text), {
        productId: target.id,
        brand: price.brand,
        sizeEach: price.sizeEach,
        packCount: price.packCount,
      });
    }
  }

  await db.$transaction([
    db.priceEntry.deleteMany({ where: { receiptId: receipt.id } }),
    db.priceEntry.createMany({ data: entries }),
    ...[...aliases].map(([text, alias]) =>
      db.productAlias.upsert({
        where: { workspaceId_text: { workspaceId: workspace.id, text } },
        create: { workspaceId: workspace.id, text, ...alias },
        update: alias,
      }),
    ),
    db.receipt.update({ where: { id: receipt.id }, data: { itemsSavedAt: new Date() } }),
  ]);
  revalidatePath("/precios", "layout");
  revalidatePath("/facturas", "layout");
  return { error: null };
}
