import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { toSeenPrice } from "@/lib/prices";
import { formatPack, formatUnitPrice, type ProductUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

import { DeletePriceButton } from "./product-settings";

const SOURCE_LABEL = { MANUAL: "A mano", SHOPPING: "Lista de compras", RECEIPT: "Factura" } as const;

type Entry = Parameters<typeof toSeenPrice>[0] & {
  id: string;
  source: keyof typeof SOURCE_LABEL;
};

// Historial de precios de un producto. `editable`: con botón para borrar cada precio (solo en "Editar").
export function PriceHistory({
  history,
  unit,
  currency,
  editable = false,
}: {
  history: Entry[];
  unit: ProductUnit;
  currency: string;
  editable?: boolean;
}) {
  if (history.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-medium">Historial</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {history.map((entry) => {
          const seen = toSeenPrice(entry);
          return (
            <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.store.name}
                  {entry.branch && <span className="font-normal text-muted-foreground"> · {entry.branch}</span>}
                  {entry.onSale && <span className={cn("ml-2 text-xs font-semibold text-income")}>Oferta</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(entry.date, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {[entry.brand, formatPack(entry.sizeEach, entry.packCount, unit)].filter(Boolean).join(" · ")} ·{" "}
                  {SOURCE_LABEL[entry.source]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatAmount(seen.priceCents, currency)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatUnitPrice(seen.unitCents, unit, currency)}
                </p>
              </div>
              {editable && <DeletePriceButton priceId={entry.id} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
