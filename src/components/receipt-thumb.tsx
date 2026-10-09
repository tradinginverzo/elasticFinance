import { FileTextIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Miniatura de una factura (foto o PDF). Al tocarla se abre el archivo completo.
export function ReceiptThumb({
  url,
  isPdf,
  className,
}: {
  url: string | null;
  isPdf: boolean;
  className?: string;
}) {
  const content = isPdf || !url ? (
    <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <FileTextIcon className="size-6" />
      <span className="text-[10px] font-medium">{isPdf ? "PDF" : "Factura"}</span>
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage
    <img src={url} alt="Factura" className="size-full object-cover" />
  );

  const classes = cn("block size-16 shrink-0 overflow-hidden rounded-lg border bg-muted", className);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={classes} aria-label="Ver factura">
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}
