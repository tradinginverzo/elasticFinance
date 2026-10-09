"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ReceiptThumb } from "@/components/receipt-thumb";
import { ReceiptUploader } from "@/components/receipt-uploader";
import { Button } from "@/components/ui/button";
import type { ReceiptView } from "@/lib/receipt-types";

import { attachReceipt, deleteReceipt } from "../facturas/actions";

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
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("¿Borrar esta factura? El movimiento no se borra.")) return;
    startTransition(async () => {
      const result = await deleteReceipt(id);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-sm font-medium">Facturas</h2>
      {receipts.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {receipts.map((r) => (
            <li key={r.id} className="relative">
              <ReceiptThumb url={r.url} isPdf={r.mimeType === "application/pdf"} className="size-20" />
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                aria-label="Borrar factura"
                className="absolute -top-2 -right-2 rounded-full shadow"
                disabled={pending}
                onClick={() => remove(r.id)}
              >
                <Trash2Icon />
              </Button>
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
