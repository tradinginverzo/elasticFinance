// Precio tal como se escribe en un formulario (texto), y su conversión a valores guardables.
// Lo usan el navegador (veredicto en vivo) y las Server Actions (validación).

import { parseAmountToCents } from "@/lib/money";
import { type ProductUnit, parseQuantity, SIZE_UNITS, toBaseSize } from "@/lib/units";

export type PriceDraft = {
  brand: string;
  sizeValue: string; // "500", "1,5"
  sizeUnit: string; // "ml", "l", "g", "kg", "u"
  packCount: string; // unidades en el paquete
  price: string; // lo que cuesta el paquete
  onSale: boolean;
  regularPrice: string; // precio normal, si está en oferta (opcional)
};

export function emptyDraft(unit: ProductUnit): PriceDraft {
  return {
    brand: "",
    sizeValue: unit === "UNIT" ? "1" : "",
    sizeUnit: SIZE_UNITS[unit][0].value,
    packCount: "1",
    price: "",
    onSale: false,
    regularPrice: "",
  };
}

export type ParsedPrice = {
  brand: string | null;
  sizeEach: number;
  packCount: number;
  priceCents: number;
  regularPriceCents: number | null;
  onSale: boolean;
};

export function parseDraft(draft: PriceDraft, unit: ProductUnit): { error: string } | ParsedPrice {
  const size = parseQuantity(draft.sizeValue);
  const sizeEach = size === null ? null : toBaseSize(size, draft.sizeUnit, unit);
  if (sizeEach === null) return { error: "Escribe la medida (por ejemplo 500 ml)." };
  const packCount = Number(draft.packCount || "1");
  if (!Number.isInteger(packCount) || packCount < 1 || packCount > 999) {
    return { error: "Las unidades del paquete deben ser un número entero." };
  }
  const price = parseAmountToCents(draft.price);
  if (price === null || price <= BigInt(0)) return { error: "Escribe el precio." };
  let regularPriceCents: number | null = null;
  if (draft.onSale && draft.regularPrice.trim()) {
    const regular = parseAmountToCents(draft.regularPrice);
    if (regular === null || regular <= price) return { error: "El precio normal debe ser mayor que el de oferta." };
    regularPriceCents = Number(regular);
  }
  return {
    brand: draft.brand.trim().slice(0, 60) || null,
    sizeEach,
    packCount,
    priceCents: Number(price),
    regularPriceCents,
    onSale: draft.onSale,
  };
}
