"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ReceiptUploader } from "@/components/receipt-uploader";
import { Button } from "@/components/ui/button";

import { deleteReceipt } from "./actions";

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

export function DeleteReceiptButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Borrar factura"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Borrar esta factura?")) return;
        startTransition(async () => {
          await deleteReceipt(receiptId);
          router.refresh();
        });
      }}
    >
      <Trash2Icon />
    </Button>
  );
}
