"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import type { PriceDraft } from "@/lib/price-draft";
import { type ProductUnit, SIZE_UNITS } from "@/lib/units";
import { cn } from "@/lib/utils";

// Campos de un precio: marca, medida (con unidades por paquete), precio y oferta.
export function PriceFields({
  draft,
  onChange,
  unit,
  currency,
  idPrefix,
  autoFocusPrice = false,
}: {
  draft: PriceDraft;
  onChange: (draft: PriceDraft) => void;
  unit: ProductUnit;
  currency: string;
  idPrefix: string;
  autoFocusPrice?: boolean;
}) {
  const set = <K extends keyof PriceDraft>(key: K, value: PriceDraft[K]) => onChange({ ...draft, [key]: value });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("price")}>Precio ({currency})</Label>
          <Input
            id={id("price")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            autoFocus={autoFocusPrice}
            className="h-10 text-lg font-semibold tabular-nums"
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("brand")}>Marca</Label>
          <Input
            id={id("brand")}
            autoComplete="off"
            placeholder="Opcional"
            className="h-10"
            maxLength={60}
            value={draft.brand}
            onChange={(e) => set("brand", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={id("size")}>{unit === "UNIT" ? "Unidades" : "Medida"}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={id("size")}
            inputMode="decimal"
            autoComplete="off"
            placeholder={unit === "ML" ? "500" : unit === "G" ? "400" : "1"}
            className="h-10 min-w-0 flex-1 tabular-nums"
            value={draft.sizeValue}
            onChange={(e) => set("sizeValue", e.target.value)}
          />
          {SIZE_UNITS[unit].length > 1 ? (
            <div className="w-20 shrink-0">
              <NativeSelect
                aria-label="Unidad de medida"
                value={draft.sizeUnit}
                onChange={(e) => set("sizeUnit", e.target.value)}
              >
                {SIZE_UNITS[unit].map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">unid.</span>
          )}
          {unit !== "UNIT" && (
            <>
              <span className="text-sm text-muted-foreground">×</span>
              <Input
                aria-label="Unidades en el paquete"
                inputMode="numeric"
                autoComplete="off"
                className="h-10 w-14 shrink-0 text-center tabular-nums"
                value={draft.packCount}
                onChange={(e) => set("packCount", e.target.value.replace(/\D/g, ""))}
              />
            </>
          )}
        </div>
        {unit !== "UNIT" && (
          <p className="text-xs text-muted-foreground">
            Si es un pack, escribe cuántas trae a la derecha (p. ej. 3 × 400 g).
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={draft.onSale}
          onChange={(e) => set("onSale", e.target.checked)}
        />
        Está en oferta
      </label>
      {draft.onSale && (
        <div className={cn("flex flex-col gap-2")}>
          <Label htmlFor={id("regular")}>Precio normal (sin oferta)</Label>
          <Input
            id={id("regular")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Opcional"
            className="h-10 tabular-nums"
            value={draft.regularPrice}
            onChange={(e) => set("regularPrice", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
