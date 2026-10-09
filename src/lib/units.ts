// Medidas de los productos del comparador. Todo se guarda en la unidad base (ml, g o unidad)
// y se muestra en la más cómoda (1 L, 500 ml, 1,5 kg…).

export type ProductUnit = "ML" | "G" | "UNIT";

export const PRODUCT_UNITS: readonly { value: ProductUnit; label: string; hint: string }[] = [
  { value: "ML", label: "Líquido", hint: "ml / L" },
  { value: "G", label: "Peso", hint: "g / kg" },
  { value: "UNIT", label: "Unidades", hint: "rollos, huevos…" },
];

// Unidades que se pueden escribir para cada tipo de producto, con su factor a la unidad base.
export const SIZE_UNITS: Record<ProductUnit, readonly { value: string; label: string; factor: number }[]> = {
  ML: [
    { value: "ml", label: "ml", factor: 1 },
    { value: "l", label: "L", factor: 1000 },
  ],
  G: [
    { value: "g", label: "g", factor: 1 },
    { value: "kg", label: "kg", factor: 1000 },
  ],
  UNIT: [{ value: "u", label: "unid.", factor: 1 }],
};

// Lo que muestra el precio por unidad: por litro, por kilo o por unidad.
const DISPLAY = {
  ML: { factor: 1000, label: "L" },
  G: { factor: 1000, label: "kg" },
  UNIT: { factor: 1, label: "unid." },
} as const;

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

// "1,5" / "1.5" → 1.5 (null si no es un número positivo).
export function parseQuantity(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Medida escrita (500 + "ml", 1 + "l") → unidad base.
export function toBaseSize(value: number, sizeUnit: string, unit: ProductUnit): number | null {
  const option = SIZE_UNITS[unit].find((u) => u.value === sizeUnit);
  return option ? value * option.factor : null;
}

// Unidad base → lo que se escribe en el formulario: 1000 ml → { value: "1", unit: "l" }.
export function fromBaseSize(base: number, unit: ProductUnit): { value: string; unit: string } {
  const [small, big] = SIZE_UNITS[unit];
  if (big && base >= big.factor) return { value: String(base / big.factor).replace(".", ","), unit: big.value };
  return { value: String(base).replace(".", ","), unit: small.value };
}

// 1000 → "1 L"; 500 → "500 ml"; 4 → "4 unid."
export function formatSize(base: number, unit: ProductUnit): string {
  const [small, big] = SIZE_UNITS[unit];
  if (big && base >= big.factor) return `${number.format(base / big.factor)} ${big.label}`;
  return `${number.format(base)} ${small.label}`;
}

// "3 × 400 g" o "1 L". En unidades se muestra el total: "4 unid.".
export function formatPack(sizeEach: number, packCount: number, unit: ProductUnit): string {
  if (unit === "UNIT") return formatSize(sizeEach * packCount, unit);
  const size = formatSize(sizeEach, unit);
  return packCount > 1 ? `${packCount} × ${size}` : size;
}

// Centavos por unidad base → "$4,50 / L".
export function formatUnitPrice(centsPerBase: number, unit: ProductUnit, currency: string): string {
  const { factor, label } = DISPLAY[unit];
  const amount = new Intl.NumberFormat("es", { style: "currency", currency, useGrouping: "always" }).format(
    (centsPerBase * factor) / 100,
  );
  return `${amount} / ${label}`;
}
