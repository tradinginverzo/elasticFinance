// Colores disponibles para las categorías. Cada categoría de un espacio tiene uno distinto
// (no se repiten mientras queden libres). Tonos medios: la inicial en blanco se lee bien
// en modo claro y oscuro.
export const CATEGORY_COLORS = [
  "#2563eb", // azul
  "#16a34a", // verde
  "#ea580c", // naranja
  "#7c3aed", // violeta
  "#e11d48", // rosa fuerte
  "#0891b2", // cian
  "#d97706", // ámbar
  "#db2777", // rosa
  "#0d9488", // turquesa
  "#4f46e5", // índigo
  "#65a30d", // lima
  "#c026d3", // fucsia
  "#b45309", // marrón
  "#0369a1", // azul océano
  "#be123c", // carmesí
  "#4d7c0f", // oliva
  "#9333ea", // púrpura
  "#0f766e", // verde azulado
  "#57534e", // piedra
  "#475569", // pizarra
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const FALLBACK_CATEGORY_COLOR = "#71717a"; // gris: sin categoría o sin color

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value);
}

// Primer color de la paleta que no esté en uso (null si están todos ocupados).
export function firstFreeColor(used: Iterable<string | null>) {
  const taken = new Set(used);
  return CATEGORY_COLORS.find((c) => !taken.has(c)) ?? null;
}
