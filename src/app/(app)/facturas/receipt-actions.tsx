"use client";

import { useRouter } from "next/navigation";

import { ReceiptUploader } from "@/components/receipt-uploader";

// Sube y lee la factura; después abre el formulario de movimiento ya rellenado.
export function UploadReceipt({ readingEnabled }: { readingEnabled: boolean }) {
  const router = useRouter();
  return (
    <ReceiptUploader
      label={readingEnabled ? "Leer factura" : "Subir factura"}
      onUploaded={({ receiptId }) => router.push(`/movimientos/nuevo?factura=${receiptId}`)}
    />
  );
}
