// Filtros y orden del listado de movimientos, guardados en la dirección de la página
// (/movimientos?tipo=EXPENSE&orden=monto_desc…) para que sobrevivan a recargar y volver atrás.

import { parseAmountToCents } from "@/lib/money";

export const MOVEMENT_TYPES = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
  { value: "TRANSFER", label: "Transferencia" },
] as const;

export const ACCOUNT_TYPES = [
  { value: "CASH", label: "Efectivo" },
  { value: "BANK", label: "Banco" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito" },
  { value: "SAVINGS", label: "Ahorros" },
] as const;

export const SORTS = [
  { value: "fecha_desc", label: "Más recientes primero" },
  { value: "fecha_asc", label: "Más antiguos primero" },
  { value: "monto_desc", label: "Monto: mayor a menor" },
  { value: "monto_asc", label: "Monto: menor a mayor" },
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number]["value"];
export type AccountTypeFilter = (typeof ACCOUNT_TYPES)[number]["value"];
export type Sort = (typeof SORTS)[number]["value"];

export type Filters = {
  q: string; // comercio, sucursal, notas, categoría o cuenta
  tipo: MovementType | null;
  cuenta: string | null; // id de cuenta
  tipoCuenta: AccountTypeFilter | null;
  cat: string | null; // nombre de categoría ("Trading" incluye la de gasto y la de ingreso)
  min: string; // monto tal como se escribió ("10", "12,50")
  max: string;
  desde: string; // "2026-10-01" (si hay rango, reemplaza la navegación por meses)
  hasta: string;
  orden: Sort;
};

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const tipo = one(params.tipo);
  const tipoCuenta = one(params.tipoCuenta);
  const orden = one(params.orden);
  const cuenta = one(params.cuenta);
  const cat = one(params.cat);
  const amount = (v: string) => (parseAmountToCents(v) === null ? "" : v.trim());
  return {
    q: one(params.q).trim().slice(0, 100),
    tipo: MOVEMENT_TYPES.some((t) => t.value === tipo) ? (tipo as MovementType) : null,
    cuenta: UUID.test(cuenta) ? cuenta : null,
    tipoCuenta: ACCOUNT_TYPES.some((t) => t.value === tipoCuenta) ? (tipoCuenta as AccountTypeFilter) : null,
    cat: cat.trim().slice(0, 60) || null,
    min: amount(one(params.min)),
    max: amount(one(params.max)),
    desde: DATE.test(one(params.desde)) ? one(params.desde) : "",
    hasta: DATE.test(one(params.hasta)) ? one(params.hasta) : "",
    orden: SORTS.some((s) => s.value === orden) ? (orden as Sort) : "fecha_desc",
  };
}

// Filtros → parámetros de la dirección (solo los que tienen valor; el mes se conserva aparte).
export function filtersToParams(filters: Filters, month?: string): URLSearchParams {
  const params = new URLSearchParams();
  const hasRange = Boolean(filters.desde || filters.hasta);
  if (month && !hasRange) params.set("mes", month);
  if (filters.q) params.set("q", filters.q);
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.cuenta) params.set("cuenta", filters.cuenta);
  if (filters.tipoCuenta) params.set("tipoCuenta", filters.tipoCuenta);
  if (filters.cat) params.set("cat", filters.cat);
  if (filters.min) params.set("min", filters.min);
  if (filters.max) params.set("max", filters.max);
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.orden !== "fecha_desc") params.set("orden", filters.orden);
  return params;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  tipo: null,
  cuenta: null,
  tipoCuenta: null,
  cat: null,
  min: "",
  max: "",
  desde: "",
  hasta: "",
  orden: "fecha_desc",
};

// ¿Hay algún filtro (sin contar el buscador ni el orden)? Para el número del botón "Filtros".
export function countPanelFilters(f: Filters) {
  return [f.tipo, f.cuenta, f.tipoCuenta, f.cat, f.min || f.max, f.desde || f.hasta].filter(Boolean).length;
}

export function hasAnyFilter(f: Filters) {
  return Boolean(f.q) || countPanelFilters(f) > 0;
}
