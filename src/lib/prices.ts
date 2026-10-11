import "server-only";

import { todayInput } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  buildReference,
  type ProductReference,
  REFERENCE_DAYS,
  type SeenPrice,
  unitCents,
} from "@/lib/price-compare";
import type { ProductUnit } from "@/lib/units";

// "  detergente   líquido " → "Detergente líquido"
export function cleanName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.charAt(0).toLocaleUpperCase("es") + clean.slice(1);
}

// Texto de una línea de factura, para recordarla: "Det liq  Deja 1000ml" → "DET LIQ DEJA 1000ML".
export function aliasText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleUpperCase("es");
}

export function getStores(workspaceId: string) {
  return db.store.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// Supermercado por nombre (sin distinguir mayúsculas); lo crea si no existe.
export async function findOrCreateStore(workspaceId: string, rawName: string) {
  const name = cleanName(rawName);
  const existing = await db.store.findFirst({
    where: { workspaceId, name: { equals: name, mode: "insensitive" } },
  });
  return existing ?? db.store.create({ data: { workspaceId, name } });
}

// Producto por nombre (sin distinguir mayúsculas); lo crea con esa medida si no existe.
export async function findOrCreateProduct(workspaceId: string, rawName: string, unit: ProductUnit) {
  const name = cleanName(rawName);
  const existing = await db.product.findFirst({
    where: { workspaceId, name: { equals: name, mode: "insensitive" } },
  });
  return existing ?? db.product.create({ data: { workspaceId, name, unit } });
}

// Sucursal opcional: "  las americas " → "Las americas"; vacío → null.
export function cleanBranch(branch: string | null | undefined) {
  const clean = branch ? cleanName(branch).slice(0, 60) : "";
  return clean || null;
}

// Sucursales ya usadas en cada supermercado (para sugerirlas al escribir).
export async function getBranches(workspaceId: string): Promise<Record<string, string[]>> {
  const rows = await db.priceEntry.findMany({
    where: { workspaceId, branch: { not: null } },
    distinct: ["storeId", "branch"],
    select: { storeId: true, branch: true },
    orderBy: { branch: "asc" },
  });
  const byStore: Record<string, string[]> = {};
  for (const r of rows) (byStore[r.storeId] ??= []).push(r.branch!);
  return byStore;
}

// Todas las sucursales usadas en el espacio, para sugerirlas en el formulario de movimientos.
export async function getAllBranches(workspaceId: string): Promise<string[]> {
  const [prices, transactions] = await Promise.all([
    db.priceEntry.findMany({
      where: { workspaceId, branch: { not: null } },
      distinct: ["branch"],
      select: { branch: true },
    }),
    db.transaction.findMany({
      where: { workspaceId, branch: { not: null } },
      distinct: ["branch"],
      select: { branch: true },
    }),
  ]);
  return [...new Set([...prices, ...transactions].map((r) => r.branch!))].sort((a, b) => a.localeCompare(b, "es"));
}

type EntryWithStore = {
  storeId: string;
  branch: string | null;
  store: { name: string };
  brand: string | null;
  sizeEach: number;
  packCount: number;
  priceCents: bigint;
  regularPriceCents: bigint | null;
  onSale: boolean;
  date: Date;
};

export function toSeenPrice(entry: EntryWithStore): SeenPrice {
  const priceCents = Number(entry.priceCents);
  return {
    storeId: entry.storeId,
    storeName: entry.store.name,
    branch: entry.branch,
    brand: entry.brand,
    sizeEach: entry.sizeEach,
    packCount: entry.packCount,
    priceCents,
    regularPriceCents: entry.regularPriceCents === null ? null : Number(entry.regularPriceCents),
    onSale: entry.onSale,
    unitCents: unitCents(priceCents, entry.sizeEach, entry.packCount),
    date: entry.date.toISOString().slice(0, 10),
  };
}

// Referencia de precios (último precio normal y oferta reciente por supermercado) de los
// productos del espacio, o solo de los indicados.
export async function getProductReferences(
  workspaceId: string,
  productIds?: string[],
): Promise<Map<string, ProductReference>> {
  const today = todayInput();
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - REFERENCE_DAYS);

  const products = await db.product.findMany({
    where: { workspaceId, ...(productIds ? { id: { in: productIds } } : {}) },
    orderBy: { name: "asc" },
    include: {
      priceEntries: {
        where: { date: { gte: since } },
        include: { store: { select: { name: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  return new Map(
    products.map((p) => [p.id, buildReference(p, p.priceEntries.map(toSeenPrice), today)]),
  );
}

// Producto elegido en el buscador: uno existente del espacio, o uno nuevo.
export async function resolvePickedProduct(
  workspaceId: string,
  picked: { id: string } | { name: string; unit: ProductUnit },
) {
  if ("id" in picked) return db.product.findFirst({ where: { id: picked.id, workspaceId } });
  const name = picked.name.trim();
  if (!name || name.length > 60 || !["ML", "G", "UNIT"].includes(picked.unit)) return null;
  return findOrCreateProduct(workspaceId, name, picked.unit);
}
