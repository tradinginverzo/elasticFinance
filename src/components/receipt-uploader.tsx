"use client";

import { CameraIcon, LoaderCircleIcon, SmartphoneIcon } from "lucide-react";
import { useRef, useState } from "react";

import { deleteReceipt, scanReceipt, startReceiptUpload } from "@/app/(app)/facturas/actions";
import { PhoneCaptureDialog, type PhoneReceipt } from "@/components/phone-capture-dialog";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import type { ReceiptScan } from "@/lib/receipt-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type UploadedReceipt = {
  receiptId: string;
  previewUrl: string | null; // URL de la foto para la miniatura (null en PDFs)
  isPdf: boolean;
  scan: ReceiptScan | null;
  error: string | null; // la factura se subió, pero no se pudo leer
  readingEnabled: boolean;
};

// Botón "Subir factura": foto (cámara o galería en el iPhone) o PDF → Storage → lectura con IA.
// En el PC además: foto con el teléfono escaneando un QR.
export function ReceiptUploader({
  onUploaded,
  label = "Subir factura",
  read = true,
  className,
}: {
  onUploaded: (receipt: UploadedReceipt) => void | Promise<void>;
  label?: string;
  read?: boolean; // false: solo guarda el archivo (p. ej. al adjuntarlo a un movimiento ya registrado)
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  // Ya en Storage: la IA la lee (si corresponde) y se entrega al formulario.
  async function finish(receipt: Omit<UploadedReceipt, "scan" | "error" | "readingEnabled">) {
    setStep("reading");
    const result = read ? await scanReceipt(receipt.receiptId) : { scan: null, error: null, enabled: false };
    await onUploaded({ ...receipt, scan: result.scan, error: result.error, readingEnabled: result.enabled });
  }

  async function handleFile(file: File) {
    setError(null);
    setStep("uploading");
    let receiptId: string | null = null;
    let uploaded = false;
    try {
      const blob = await compressImage(file);
      const mimeType = blob.type || file.type;
      const started = await startReceiptUpload(mimeType, blob.size);
      if (started.error !== null) throw new Error(started.error);
      receiptId = started.receiptId;

      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from("receipts")
        .uploadToSignedUrl(started.path, started.token, blob, { contentType: mimeType });
      if (uploadError) throw new Error("No se pudo subir el archivo. Inténtalo de nuevo.");

      uploaded = true;
      const isPdf = mimeType === "application/pdf";
      await finish({ receiptId: started.receiptId, previewUrl: isPdf ? null : URL.createObjectURL(blob), isPdf });
    } catch (e) {
      // Si el archivo no llegó, no dejamos la factura a medias.
      if (receiptId && !uploaded) await deleteReceipt(receiptId).catch(() => {});
      setError(e instanceof Error ? e.message : "No se pudo subir la factura.");
    } finally {
      setStep("idle");
    }
  }

  // La foto llegó desde el teléfono (ya está subida).
  async function handlePhone(receipt: PhoneReceipt) {
    setError(null);
    try {
      await finish(receipt);
    } catch {
      setError("No se pudo leer la factura del teléfono.");
    } finally {
      setStep("idle");
    }
  }

  const busy = step !== "idle";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permite elegir el mismo archivo otra vez
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-10"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <LoaderCircleIcon className="animate-spin" /> : <CameraIcon />}
        {step === "idle" ? label : step === "reading" && read ? "Leyendo la factura…" : "Subiendo…"}
      </Button>

      {/* Solo en equipos con mouse (PC): en el iPhone el botón de arriba ya abre la cámara. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hidden pointer-fine:inline-flex"
        disabled={busy}
        onClick={() => setPhoneOpen(true)}
      >
        <SmartphoneIcon />
        Tomar la foto con el teléfono
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <PhoneCaptureDialog open={phoneOpen} onOpenChange={setPhoneOpen} onReceived={(r) => void handlePhone(r)} />
    </div>
  );
}
