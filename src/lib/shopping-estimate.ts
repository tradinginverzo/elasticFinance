// Estimado de lo que costará un producto de la lista de compras (por paquete), sin IA:
// 1) el que escribiste, 2) el último precio en el súper elegido, 3) el último en el más barato.

import { bestRegular, type ProductReference } from "@/lib/price-compare";

export type ItemEstimate =
  | { cents: number; source: "mine" }
  | { cents: number; source: "here" | "best"; storeName: string }
  | { cents: null; source: null };

export function itemEstimate(
  estimateCents: number | null,
  reference: ProductReference | undefined,
  storeId: string | null,
): ItemEstimate {
  if (estimateCents !== null) return { cents: estimateCents, source: "mine" };
  const here = storeId ? reference?.stores.find((s) => s.storeId === storeId)?.regular : null;
  if (here) return { cents: here.priceCents, source: "here", storeName: here.storeName };
  const best = reference ? bestRegular(reference) : null;
  if (best) return { cents: best.priceCents, source: "best", storeName: best.storeName };
  return { cents: null, source: null };
}

// "Tu estimado" / "Último en Tuti" / "Más barato: Tuti".
export function estimateLabel(e: ItemEstimate) {
  if (e.source === "mine") return "Tu estimado";
  if (e.source === "here") return `Último en ${e.storeName}`;
  if (e.source === "best") return `Más barato: ${e.storeName}`;
  return "Sin estimado";
}
