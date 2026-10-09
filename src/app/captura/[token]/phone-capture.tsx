"use client";

import { CameraIcon, CircleCheckIcon, FileTextIcon, ImageIcon, LoaderCircleIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { finishCaptureUpload, startCaptureUpload } from "../actions";

// Teléfono: tomar (o elegir) la foto, revisarla y enviarla al PC.
export function PhoneCapture({ token, workspaceName }: { token: string; workspaceName: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "sending" | "done">("pick");
  const [error, setError] = useState<string | null>(null);

  function choose(picked: File | undefined) {
    if (!picked) return;
    setError(null);
    setFile(picked);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(picked.type === "application/pdf" ? null : URL.createObjectURL(picked));
  }

  async function send() {
    if (!file) return;
    setStep("sending");
    setError(null);
    try {
      const blob = await compressImage(file);
      const mimeType = blob.type || file.type;
      const started = await startCaptureUpload(token, mimeType, blob.size);
      if (started.error !== null) throw new Error(started.error);
      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from("receipts")
        .uploadToSignedUrl(started.path, started.token, blob, { contentType: mimeType });
      if (uploadError) throw new Error("No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.");
      const finished = await finishCaptureUpload(token, started.receiptId);
      if (finished.error) throw new Error(finished.error);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la foto.");
      setStep("pick");
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheckIcon className="size-14 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">¡Enviada!</h1>
        <p className="text-muted-foreground">Mira el PC: la factura ya está allí. Puedes cerrar esta página.</p>
      </div>
    );
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {inputs}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Foto de la factura</h1>
        <p className="text-sm text-muted-foreground">
          Para {workspaceName}. Que se vea entera, con buena luz y sin sombras.
        </p>
      </div>

      {file ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-muted">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local
              <img src={preview} alt="Factura" className="max-h-[55dvh] w-full object-contain" />
            ) : (
              <div className="flex items-center gap-3 p-4 text-sm">
                <FileTextIcon className="size-6 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
          </div>
          <Button className="h-12 text-base" disabled={step === "sending"} onClick={send}>
            {step === "sending" && <LoaderCircleIcon className="animate-spin" />}
            {step === "sending" ? "Enviando…" : "Enviar al PC"}
          </Button>
          <Button
            variant="outline"
            className="h-11"
            disabled={step === "sending"}
            onClick={() => cameraRef.current?.click()}
          >
            <CameraIcon />
            Tomar otra
          </Button>
        </>
      ) : (
        <>
          <Button className="h-14 text-base" onClick={() => cameraRef.current?.click()}>
            <CameraIcon className="size-5" />
            Tomar foto
          </Button>
          <Button variant="outline" className="h-11" onClick={() => galleryRef.current?.click()}>
            <ImageIcon />
            Elegir de la galería o archivos
          </Button>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
