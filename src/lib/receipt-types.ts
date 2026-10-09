// Tipos de facturas compartidos entre el servidor y el navegador.

// Lo que la IA leyó de la factura, listo para rellenar el formulario de movimientos.
export type ReceiptScan = {
  type: "EXPENSE" | "INCOME";
  amount: string | null; // como en el campo "Monto" ("12,50")
  date: string | null; // "2026-10-04"
  merchant: string | null;
  branch: string | null; // sucursal, si la factura la dice
  categoryId: string | null;
  notes: string | null;
  itemCount: number; // productos leídos (para el comparador de precios)
};

// Factura para mostrar: URL firmada temporal del archivo (el bucket es privado).
export type ReceiptView = {
  id: string;
  url: string | null;
  mimeType: string;
  status: "UPLOADED" | "PROCESSING" | "PROCESSED" | "CONFIRMED" | "FAILED";
  priceCount: number; // precios guardados en el comparador desde esta factura
};

// Tipos de archivo que acepta el bucket "receipts" (ver scripts/setup-storage.mjs).
export const RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
