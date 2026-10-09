// Comparación de precios entre supermercados. Son solo cálculos (sin IA): se usan en el
// servidor y también en el navegador, para dar el veredicto mientras se escribe el precio.

import type { ProductUnit } from "@/lib/units";

// Un precio visto, ya reducido a precio por unidad base (centavos por ml, g o unidad).
export type SeenPrice = {
  storeId: string;
  storeName: string;
  brand: string | null;
  sizeEach: number;
  packCount: number;
  priceCents: number;
  regularPriceCents: number | null;
  onSale: boolean;
  unitCents: number;
  date: string; // "2026-10-08"
};

// Lo último que sabemos de un producto en cada supermercado.
export type StoreReference = {
  storeId: string;
  storeName: string;
  regular: SeenPrice | null; // último precio normal (sin oferta)
  offer: SeenPrice | null; // oferta vista hace poco (puede que ya no esté)
};

export type ProductReference = {
  productId: string;
  name: string;
  unit: ProductUnit;
  stores: StoreReference[];
};

// Solo se comparan precios de los últimos meses (los precios cambian).
export const REFERENCE_DAYS = 180;
// Una oferta se considera "reciente" durante estos días.
export const OFFER_DAYS = 14;

export function unitCents(priceCents: number, sizeEach: number, packCount: number) {
  return priceCents / (sizeEach * packCount);
}

// Precios del producto (más recientes primero) → referencia por supermercado.
export function buildReference(
  product: { id: string; name: string; unit: ProductUnit },
  prices: SeenPrice[],
  today: string,
): ProductReference {
  const offerSince = shiftDays(today, -OFFER_DAYS);
  const stores = new Map<string, StoreReference>();
  for (const price of prices) {
    const store = stores.get(price.storeId) ?? {
      storeId: price.storeId,
      storeName: price.storeName,
      regular: null,
      offer: null,
    };
    if (!price.onSale && !store.regular) store.regular = price;
    if (price.onSale && !store.offer && price.date >= offerSince) store.offer = price;
    stores.set(price.storeId, store);
  }
  return { productId: product.id, name: product.name, unit: product.unit, stores: [...stores.values()] };
}

// Mejor precio normal entre los supermercados (opcionalmente sin contar uno).
export function bestRegular(reference: ProductReference, exceptStoreId?: string): SeenPrice | null {
  let best: SeenPrice | null = null;
  for (const store of reference.stores) {
    if (store.storeId === exceptStoreId || !store.regular) continue;
    if (!best || store.regular.unitCents < best.unitCents) best = store.regular;
  }
  return best;
}

export type Verdict =
  // No hay precios de otros supermercados para comparar.
  | { kind: "first" }
  // Aquí es lo más barato: cuánto ahorras frente al mejor de los demás.
  | { kind: "best"; savingsCents: number; percent: number; other: SeenPrice; equivalent: Equivalent }
  // En otro supermercado sale más barato: cuánto ahorrarías allí.
  | { kind: "worse"; extraCents: number; percent: number; other: SeenPrice; equivalent: Equivalent };

// Lo mismo que llevas, comprado en el otro supermercado: "2 × 500 ml = $4,00".
export type Equivalent = { count: number | null; costCents: number };

// Compara el precio que tienes delante (paquete de `totalSize` en unidad base) con los demás supermercados.
export function evaluatePrice(
  reference: ProductReference,
  current: { storeId: string; priceCents: number; totalSize: number },
): Verdict & { lastHere: SeenPrice | null } {
  const lastHere = reference.stores.find((s) => s.storeId === current.storeId)?.regular ?? null;
  const other = bestRegular(reference, current.storeId);
  if (!other || current.totalSize <= 0) return { kind: "first", lastHere };

  const currentUnit = current.priceCents / current.totalSize;
  const otherCost = other.unitCents * current.totalSize;
  const otherPackSize = other.sizeEach * other.packCount;
  const ratio = current.totalSize / otherPackSize;
  const equivalent: Equivalent = {
    // Solo si encaja en paquetes enteros (1 L = 2 × 500 ml); si no, se compara por litro/kilo.
    count: ratio >= 1 && Math.abs(ratio - Math.round(ratio)) < 0.05 ? Math.round(ratio) : null,
    costCents: otherCost,
  };

  if (currentUnit <= other.unitCents) {
    const savingsCents = otherCost - current.priceCents;
    return { kind: "best", savingsCents, percent: savingsCents / otherCost, other, equivalent, lastHere };
  }
  const extraCents = current.priceCents - otherCost;
  return { kind: "worse", extraCents, percent: extraCents / current.priceCents, other, equivalent, lastHere };
}

function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatPercent(fraction: number) {
  return new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 }).format(fraction);
}
