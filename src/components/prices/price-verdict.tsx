import { ThumbsUpIcon, TrendingDownIcon, TriangleAlertIcon } from "lucide-react";

import { formatAmount } from "@/lib/money";
import { evaluatePrice, formatPercent, type ProductReference } from "@/lib/price-compare";
import { formatPack, formatUnitPrice } from "@/lib/units";
import { cn } from "@/lib/utils";

// Veredicto del precio que tienes delante frente a los demás supermercados:
// "Mejor precio: ahorras $0,50 (11 %)" o "En Súper B sale 11 % más barato".
export function PriceVerdict({
  reference,
  storeId,
  priceCents,
  totalSize,
  quantity = 1,
  currency,
  compact = false,
}: {
  reference: ProductReference;
  storeId: string;
  priceCents: number;
  totalSize: number;
  quantity?: number;
  currency: string;
  compact?: boolean;
}) {
  const verdict = evaluatePrice(reference, { storeId, priceCents, totalSize });
  const money = (cents: number) => formatAmount(cents, currency);
  const times = quantity > 1 ? ` (× ${quantity})` : "";

  // Cambio frente a la última vez en este mismo supermercado.
  const last = verdict.lastHere;
  const lastChange = last && totalSize > 0 ? priceCents / totalSize / last.unitCents - 1 : null;
  const lastNote =
    lastChange !== null && Math.abs(lastChange) >= 0.01
      ? `${lastChange > 0 ? "Subió" : "Bajó"} ${formatPercent(Math.abs(lastChange))} desde la última vez aquí.`
      : null;

  if (verdict.kind === "first") {
    return compact ? null : (
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Aún no hay precios de otros supermercados para comparar.{lastNote ? ` ${lastNote}` : ""}
      </p>
    );
  }

  const { other, equivalent } = verdict;
  const otherDesc = equivalent.count
    ? `${equivalent.count} × ${formatPack(other.sizeEach, other.packCount, reference.unit)}${other.brand ? ` ${other.brand}` : ""} = ${money(equivalent.costCents)}`
    : `${formatUnitPrice(other.unitCents, reference.unit, currency)}`;

  if (verdict.kind === "best") {
    const saving = verdict.savingsCents * quantity;
    return (
      <div className={cn("rounded-lg bg-income/10 px-3 py-2 text-sm", compact && "px-2 py-1 text-xs")}>
        <p className="flex items-center gap-1.5 font-medium text-income">
          <ThumbsUpIcon className="size-4 shrink-0" />
          Mejor precio
          {saving >= 1 && `: ahorras ${money(saving)}${times} (${formatPercent(verdict.percent)})`}
        </p>
        {!compact && (
          <p className="mt-0.5 text-muted-foreground">
            Frente a {other.storeName}
            {other.branch ? ` (${other.branch})` : ""}: {otherDesc}. {lastNote}
          </p>
        )}
      </div>
    );
  }

  const extra = verdict.extraCents * quantity;
  return (
    <div className={cn("rounded-lg bg-amber-500/10 px-3 py-2 text-sm", compact && "px-2 py-1 text-xs")}>
      <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
        {compact ? <TrendingDownIcon className="size-4 shrink-0" /> : <TriangleAlertIcon className="size-4 shrink-0" />}
        En {other.storeName} sale {formatPercent(verdict.percent)} más barato
        {!compact && `: ahorrarías ${money(extra)}${times}`}
      </p>
      {!compact && (
        <p className="mt-0.5 text-muted-foreground">
          Allí{other.branch ? ` (${other.branch})` : ""}: {otherDesc} ({other.date.split("-").reverse().slice(0, 2).join("/")}). {lastNote}
        </p>
      )}
    </div>
  );
}
