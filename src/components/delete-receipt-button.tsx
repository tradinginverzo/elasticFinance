"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteReceipt } from "@/app/(app)/facturas/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Papelera de una factura. Si tiene precios guardados en el comparador, pregunta si se
// borran también (los productos y los precios de otras facturas nunca se tocan).
export function DeleteReceiptButton({
  receiptId,
  priceCount,
  className,
}: {
  receiptId: string;
  priceCount: number;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(deletePrices: boolean) {
    startTransition(async () => {
      const result = await deleteReceipt(receiptId, deletePrices);
      if (result.error) return void toast.error(result.error);
      setOpen(false);
      toast.success(deletePrices ? "Factura y precios borrados" : "Factura borrada");
      router.refresh();
    });
  }

  const prices = priceCount === 1 ? "su precio" : `sus ${priceCount} precios`;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Borrar factura"
        className={className}
        disabled={pending}
        onClick={() => {
          if (priceCount > 0) return setOpen(true);
          if (confirm("¿Borrar esta factura? Se borra la foto y lo que leyó la IA.")) remove(false);
        }}
      >
        <Trash2Icon />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className={cn("pb-[max(1rem,env(safe-area-inset-bottom))]")}>
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4">
            <SheetHeader className="px-0">
              <SheetTitle>¿Borrar esta factura?</SheetTitle>
              <SheetDescription>
                Tiene {prices} en el comparador. Los productos y los precios de otras facturas no se tocan.
              </SheetDescription>
            </SheetHeader>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={() => remove(true)}>
              Borrar la factura y {prices}
            </Button>
            <Button variant="outline" className="h-10" disabled={pending} onClick={() => remove(false)}>
              Borrar solo la factura (conservar precios)
            </Button>
            <Button variant="ghost" className="h-10" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
