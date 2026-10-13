"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Recorte manual de una foto (p. ej. dejar solo el ticket): un recuadro con 4 esquinas que se
// arrastran con el dedo o el mouse, y que también se puede mover entero.

type Rect = { x: number; y: number; w: number; h: number }; // fracciones (0–1) de la imagen
type Drag = { mode: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; start: Rect };

const MIN = 0.08; // tamaño mínimo del recorte (8 % de la imagen)
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function ImageCropper({
  file,
  onDone,
  onCancel,
}: {
  file: Blob;
  onDone: (result: Blob) => void; // la foto recortada (o la original con "Usar foto completa")
  onCancel: () => void;
}) {
  // URL local de la foto (se crea una vez; el componente se monta de nuevo para otra foto).
  const [url] = useState(() => URL.createObjectURL(file));
  const [failed, setFailed] = useState(false);
  const [rect, setRect] = useState<Rect>({ x: 0.04, y: 0.04, w: 0.92, h: 0.92 });
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<Drag | null>(null);


  // Al terminar (recortar, foto completa o cancelar) se libera la vista previa. No se hace al
  // desmontar: en desarrollo React monta dos veces y la imagen quedaría rota.
  function finish(result: Blob | null) {
    URL.revokeObjectURL(url);
    if (result) onDone(result);
    else onCancel();
  }

  // Si el navegador no puede mostrar la foto (p. ej. HEIC en el PC), se usa tal cual.
  useEffect(() => {
    if (failed) finish(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando falla la carga
  }, [failed]);

  // Un solo manejador: data-mode dice si se tocó una esquina o el recuadro.
  function start(e: React.PointerEvent) {
    const mode = (e.target as HTMLElement).dataset.mode as Drag["mode"] | undefined;
    if (!mode) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    const img = imgRef.current;
    if (!d || !img) return;
    const box = img.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    const s = d.start;
    if (d.mode === "move") {
      setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    let { x, y, w, h } = s;
    if (d.mode.includes("w")) {
      const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
      w = s.w + (s.x - nx);
      x = nx;
    }
    if (d.mode.includes("e")) w = clamp(s.w + dx, MIN, 1 - s.x);
    if (d.mode.includes("n")) {
      const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
      h = s.h + (s.y - ny);
      y = ny;
    }
    if (d.mode.includes("s")) h = clamp(s.h + dy, MIN, 1 - s.y);
    setRect({ x, y, w, h });
  }

  function end() {
    drag.current = null;
  }

  async function apply() {
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);
    const sx = Math.round(rect.x * img.naturalWidth);
    const sy = Math.round(rect.y * img.naturalHeight);
    const sw = Math.round(rect.w * img.naturalWidth);
    const sh = Math.round(rect.h * img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    setBusy(false);
    finish(blob ?? file);
  }

  const corner = "absolute size-7 touch-none rounded-full border-2 border-white bg-primary shadow-md";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Arrastra las esquinas para dejar solo la factura. También puedes mover el recuadro.
      </p>
      {/* overflow-hidden: la sombra que oscurece lo de fuera no se sale de este marco. */}
      <div className="flex justify-center overflow-hidden rounded-xl bg-black/90 p-4">
        <div
          className="relative inline-block touch-none select-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto */}
          <img
            ref={imgRef}
            src={url}
            alt="Factura a recortar"
            draggable={false}
            onError={() => setFailed(true)}
            className="block max-h-[58dvh] max-w-full"
          />
          {/* Recuadro: oscurece lo de fuera con una sombra enorme. */}
          <div
            role="presentation"
            data-mode="move"
            className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          >
            <span data-mode="nw" className={cn(corner, "-top-3.5 -left-3.5 cursor-nwse-resize")} />
            <span data-mode="ne" className={cn(corner, "-top-3.5 -right-3.5 cursor-nesw-resize")} />
            <span data-mode="sw" className={cn(corner, "-bottom-3.5 -left-3.5 cursor-nesw-resize")} />
            <span data-mode="se" className={cn(corner, "-right-3.5 -bottom-3.5 cursor-nwse-resize")} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="h-11" disabled={busy} onClick={apply}>
          Usar recorte
        </Button>
        <Button variant="outline" className="h-10" disabled={busy} onClick={() => finish(file)}>
          Usar foto completa
        </Button>
        <Button variant="ghost" className="h-10" disabled={busy} onClick={() => finish(null)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
