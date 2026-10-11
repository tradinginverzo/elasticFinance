import { ReceiptIcon, TagIcon } from "lucide-react";
import Link from "next/link";

import { ReceiptThumb } from "@/components/receipt-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { receiptReadingEnabled, toReceiptViews } from "@/lib/receipts";
import { cn } from "@/lib/utils";

import { DeleteReceiptButton } from "@/components/delete-receipt-button";

import { UploadReceipt } from "./receipt-actions";

export const metadata = { title: "Facturas" };

export default async function ReceiptsPage() {
  const { workspace } = await requireWorkspace();
  const receipts = await db.receipt.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { priceEntries: true } },
      transaction: { select: { id: true, type: true, merchant: true, amountCents: true, currency: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const views = await toReceiptViews(receipts);
  const pending = receipts.filter((r) => !r.transaction).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">
            {pending > 0
              ? `${pending} sin registrar en ${workspace.name}`
              : `Fotos y PDF de tus compras en ${workspace.name}`}
          </p>
        </div>
        <UploadReceipt readingEnabled={receiptReadingEnabled()} />
      </div>

      {receipts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptIcon className="size-6" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Sube la foto o el PDF de una factura: {receiptReadingEnabled() ? "leemos el monto, la fecha y el comercio, y " : ""}
              la guardamos junto al movimiento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {receipts.map((r, i) => {
            const t = r.transaction;
            const itemCount = ((r.extractedData as { items?: unknown[] } | null)?.items ?? []).length;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <ReceiptThumb url={views[i].url} isPdf={r.mimeType === "application/pdf"} />
                <div className="min-w-0 flex-1">
                  {t ? (
                    <>
                      <p className="truncate font-medium">{t.merchant || "Movimiento"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(t.date, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                        <span
                          className={cn(
                            "tabular-nums",
                            t.type === "EXPENSE" && "text-expense",
                            t.type === "INCOME" && "text-income",
                          )}
                        >
                          {formatCents(t.amountCents, t.currency)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Sin registrar</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Subida el{" "}
                        {new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(r.createdAt)}
                        {r.status === "FAILED" ? " · no se pudo leer" : ""}
                      </p>
                    </>
                  )}
                </div>
                {/* En el móvil los botones bajan a su propia fila para no apretar el texto. */}
                <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                  {itemCount > 0 && (
                    <Button
                      variant={r.itemsSavedAt ? "ghost" : "outline"}
                      size="sm"
                      render={<Link href={`/facturas/${r.id}`} />}
                      nativeButton={false}
                      aria-label={`Precios de ${itemCount} productos`}
                    >
                      <TagIcon />
                      {r.itemsSavedAt ? itemCount : `Precios (${itemCount})`}
                    </Button>
                  )}
                  {t ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/movimientos/${t.id}`} />}
                      nativeButton={false}
                    >
                      Ver
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      render={<Link href={`/movimientos/nuevo?factura=${r.id}`} />}
                      nativeButton={false}
                    >
                      Registrar
                    </Button>
                  )}
                  <DeleteReceiptButton receiptId={r.id} priceCount={r._count.priceEntries} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
