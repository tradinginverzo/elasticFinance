import type { TransactionType } from "@/generated/prisma/client";

// Ingreso o gasto. Las categorías y los gastos fijos solo pueden ser de estos dos tipos;
// las transferencias (TRANSFER) mueven dinero entre cuentas y no tienen categoría.
export type FlowType = Exclude<TransactionType, "TRANSFER">;

export function isFlowType(type: TransactionType): type is FlowType {
  return type !== "TRANSFER";
}

// Para listas de categorías o gastos fijos: descarta (por si acaso) lo que no sea ingreso/gasto
// y deja el tipo acotado a FlowType.
export function onlyFlow<T extends { type: TransactionType }>(items: T[]) {
  return items.filter((i): i is T & { type: FlowType } => isFlowType(i.type));
}
