"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { PriceFields } from "@/components/prices/price-fields";
import { PriceVerdict } from "@/components/prices/price-verdict";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInput } from "@/lib/dates";
import type { ProductReference } from "@/lib/price-compare";
import { emptyDraft, parseDraft } from "@/lib/price-draft";
import type { ProductUnit } from "@/lib/units";

import { savePrice } from "../actions";

const NEW_STORE = "__new__";

// Anotar a mano un precio visto (folleto, web, otra visita…), con el veredicto en vivo.
export function AddPriceForm({
  productId,
  unit,
  currency,
  stores,
  reference,
}: {
  productId: string;
  unit: ProductUnit;
  currency: string;
  stores: { id: string; name: string }[];
  reference: ProductReference;
}) {
  const [storeChoice, setStoreChoice] = useState(stores[0]?.id ?? NEW_STORE);
  // Tras guardar con un supermercado nuevo, se elige ese (ya viene en `stores`).
  const [createdStore, setCreatedStore] = useState<string | null>(null);
  const created = createdStore
    ? stores.find((s) => s.name.toLocaleLowerCase("es") === createdStore.toLocaleLowerCase("es"))
    : undefined;
  const storeId = created && storeChoice === NEW_STORE ? created.id : storeChoice;
  const [newStoreName, setNewStoreName] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(unit));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dateRef.current) dateRef.current.value = todayInput();
  }, []);

  const parsed = parseDraft(draft, unit);
  const isNewStore = storeId === NEW_STORE;

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await savePrice({
            productId,
            storeId: isNewStore ? "" : storeId,
            newStoreName,
            date: dateRef.current?.value ?? "",
            draft,
          });
          setError(result.error);
          if (!result.error) {
            toast.success("Precio guardado");
            setDraft({ ...emptyDraft(unit), sizeValue: draft.sizeValue, sizeUnit: draft.sizeUnit });
            if (isNewStore) setCreatedStore(newStoreName.trim());
            setNewStoreName("");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price-store">Supermercado</Label>
          <NativeSelect
            id="price-store"
            value={storeId}
            onChange={(e) => {
              setStoreChoice(e.target.value);
              setCreatedStore(null);
            }}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_STORE}>+ Otro supermercado…</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price-date">Fecha</Label>
          <Input ref={dateRef} id="price-date" type="date" autoComplete="off" className="h-10" required />
        </div>
      </div>
      {isNewStore && (
        <Input
          aria-label="Nombre del supermercado"
          autoComplete="off"
          placeholder="Nombre del supermercado"
          className="h-10"
          maxLength={60}
          value={newStoreName}
          onChange={(e) => setNewStoreName(e.target.value)}
        />
      )}

      <PriceFields draft={draft} onChange={setDraft} unit={unit} currency={currency} idPrefix="manual" />

      {!("error" in parsed) && !isNewStore && (
        <PriceVerdict
          reference={reference}
          storeId={storeId}
          priceCents={parsed.priceCents}
          totalSize={parsed.sizeEach * parsed.packCount}
          currency={currency}
        />
      )}

      <FormError message={error} />
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Guardando…" : "Guardar precio"}
      </Button>
    </form>
  );
}
