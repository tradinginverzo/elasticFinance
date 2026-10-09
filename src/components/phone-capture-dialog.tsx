"use client";

import { LoaderCircleIcon, SmartphoneIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cancelPhoneCapture, checkPhoneCapture, startPhoneCapture } from "@/app/(app)/facturas/capture-actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type PhoneReceipt = { receiptId: string; previewUrl: string | null; isPdf: boolean };

const POLL_MS = 2000;

// PC: muestra un QR; al escanearlo con el teléfono se toma la foto allí y llega aquí sola.
export function PhoneCaptureDialog({
  open,
  onOpenChange,
  onReceived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceived: (receipt: PhoneReceipt) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tomar la foto con el teléfono</SheetTitle>
          <SheetDescription>
            Escanea el código con la cámara del iPhone, toma la foto de la factura y envíala.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <QrSession
            onReceived={(receipt) => {
              onReceived(receipt);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type Session = Awaited<ReturnType<typeof startPhoneCapture>>;

function QrSession({ onReceived }: { onReceived: (receipt: PhoneReceipt) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // El aviso más reciente, sin reiniciar la espera cada vez que el padre se vuelve a pintar.
  const onReceivedRef = useRef(onReceived);
  useEffect(() => {
    onReceivedRef.current = onReceived;
  });

  // Crea el enlace (y uno nuevo al pedir "Generar otro código").
  useEffect(() => {
    let active = true;
    let created: string | null = null;
    startPhoneCapture()
      .then((s) => {
        created = s.sessionId;
        if (active) setSession(s);
        else void cancelPhoneCapture(s.sessionId);
      })
      .catch(() => active && setError("No se pudo generar el código."));
    return () => {
      active = false;
      // Al cerrar la ventana sin recibir la foto, el enlace deja de servir.
      if (created) void cancelPhoneCapture(created);
    };
  }, [attempt]);

  // Espera la foto preguntando cada 2 segundos.
  useEffect(() => {
    if (!session || expired) return;
    let stopped = false;
    const timer = setInterval(async () => {
      const result = await checkPhoneCapture(session.sessionId).catch(() => null);
      if (stopped || !result) return;
      if (result.status === "UPLOADED") {
        stopped = true;
        clearInterval(timer);
        onReceivedRef.current({ receiptId: result.receiptId, previewUrl: result.previewUrl, isPdf: result.isPdf });
      } else if (result.status === "EXPIRED") {
        stopped = true;
        clearInterval(timer);
        setExpired(true);
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, expired]);

  if (error) return <p className="px-4 text-sm text-destructive">{error}</p>;
  if (!session) {
    return (
      <p className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" /> Generando código…
      </p>
    );
  }

  if (expired) {
    return (
      <div className="flex flex-col gap-3 px-4">
        <p className="text-sm text-muted-foreground">El código caducó (dura 10 minutos).</p>
        <Button
          onClick={() => {
            setSession(null);
            setExpired(false);
            setAttempt((a) => a + 1);
          }}
        >
          Generar otro código
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-4 text-center">
      <div
        className="w-full max-w-64 rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
        // SVG generado por nosotros en el servidor (librería qrcode) a partir del enlace.
        dangerouslySetInnerHTML={{ __html: session.qrSvg }}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SmartphoneIcon className="size-4" />
        Esperando la foto del teléfono…
        <LoaderCircleIcon className="size-4 animate-spin" />
      </p>
      {session.localOnly && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-700 dark:text-amber-400">
          Abriste la app como «localhost»: el teléfono no podrá abrir este código. En desarrollo, abre la app en el PC
          con la IP de tu red (por ejemplo http://192.168.1.67:3000). En producción no pasa.
        </p>
      )}
    </div>
  );
}
