"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeleteReceiptButton } from "@/components/delete-receipt-button";
import { ReceiptThumb } from "@/components/receipt-thumb";
import { ReceiptUploader } from "@/components/receipt-uploader";
import type { ReceiptView } from "@/lib/receipt-types";

import { attachReceipt } from "../facturas/actions";

// Facturas de un movimiento ya guardado: verlas, borrarlas o adjuntar otra.
export function TransactionReceipts({
  transactionId,
  receipts,
}: {
  transactionId: string;
  receipts: ReceiptView[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-sm font-medium">Facturas</h2>
      {receipts.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {receipts.map((r) => (
            <li key={r.id} className="relative">
              <ReceiptThumb url={r.url} isPdf={r.mimeType === "application/pdf"} className="size-20" />
              <DeleteReceiptButton
                receiptId={r.id}
                priceCount={r.priceCount}
                className="absolute -top-2 -right-2 size-6 rounded-full bg-secondary shadow"
              />
            </li>
          ))}
        </ul>
      )}
      <ReceiptUploader
        read={false}
        label={receipts.length > 0 ? "Adjuntar otra factura" : "Adjuntar factura (foto o PDF)"}
        onUploaded={async ({ receiptId }) => {
          const result = await attachReceipt(receiptId, transactionId);
          setError(result.error);
          router.refresh();
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
