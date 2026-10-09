"use client";

import { CheckIcon, MinusIcon, PencilIcon, PlusIcon, StoreIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/native-select";
import { PriceFields } from "@/components/prices/price-fields";
import { PriceVerdict } from "@/components/prices/price-verdict";
import { type PickedProduct, ProductPicker } from "@/components/prices/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatAmount } from "@/lib/money";
import { bestRegular, evaluatePrice, type ProductReference } from "@/lib/price-compare";
import { emptyDraft, type PriceDraft, parseDraft } from "@/lib/price-draft";
import { formatPack, formatUnitPrice, fromBaseSize, type ProductUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

import {
  addItem,
  deleteList,
  markItem,
  removeItem,
  renameList,
  setListCompleted,
  setListStore,
  uncheckItem,
} from "../actions";

export type ListItem = {
  id: string;
  productId: string;
  name: string;
  unit: ProductUnit;
  note: string | null;
  quantity: number;
  checked: boolean;
  price: {
    brand: string | null;
    sizeEach: number;
    packCount: number;
    priceCents: number;
    regularPriceCents: number | null;
    onSale: boolean;
  } | null;
};

const NEW_STORE = "__new__";

export function ShoppingView({
  list,
  items,
  stores,
  products,
  references,
  currency,
}: {
  list: { id: string; name: string; storeId: string | null; completed: boolean };
  items: ListItem[];
  stores: { id: string; name: string }[];
  products: { id: string; name: string; unit: ProductUnit }[];
  references: Record<string, ProductReference>;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // Solo mientras se escribe un supermercado nuevo; si no, se muestra el de la lista.
  const [storeChoice, setStoreChoice] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const money = (cents: number) => formatAmount(cents, currency);

  const run = (action: () => Promise<{ error: string | null }>, done?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else done?.();
    });

  const pendingItems = items.filter((i) => !i.checked);
  const cartItems = items.filter((i) => i.checked);
  const storeName = stores.find((s) => s.id === list.storeId)?.name ?? null;

  // Totales del carrito y ahorro frente a los demás supermercados.
  let total = 0;
  let saved = 0;
  let missed = 0;
  for (const item of cartItems) {
    if (!item.price) continue;
    total += item.price.priceCents * item.quantity;
    const reference = references[item.productId];
    if (!reference || !list.storeId) continue;
    const verdict = evaluatePrice(reference, {
      storeId: list.storeId,
      priceCents: item.price.priceCents,
      totalSize: item.price.sizeEach * item.price.packCount,
    });
    if (verdict.kind === "best") saved += verdict.savingsCents * item.quantity;
    if (verdict.kind === "worse") missed += verdict.extraCents * item.quantity;
  }

  function chooseStore(value: string) {
    if (value === NEW_STORE) return setStoreChoice(NEW_STORE);
    setStoreChoice(null);
    if (value) run(() => setListStore(list.id, value, ""));
  }

  const openItem = items.find((i) => i.id === openItemId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="truncate">{list.name}</span>
            <button
              type="button"
              aria-label="Cambiar nombre"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                const name = prompt("Nombre de la lista", list.name);
                if (name && name.trim() !== list.name) run(() => renameList(list.id, name));
              }}
            >
              <PencilIcon className="size-4" />
            </button>
          </h1>
          <p className="text-sm text-muted-foreground">
            {cartItems.length} de {items.length} en el carrito
          </p>
        </div>
      </div>

      {/* Dónde estoy comprando */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-store" className="flex items-center gap-1.5">
          <StoreIcon className="size-4" /> ¿Dónde estás comprando?
        </Label>
        <NativeSelect id="list-store" value={storeChoice ?? list.storeId ?? ""} onChange={(e) => chooseStore(e.target.value)} disabled={pending}>
          {!list.storeId && <option value="">Elige el supermercado…</option>}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NEW_STORE}>+ Otro supermercado…</option>
        </NativeSelect>
        {storeChoice === NEW_STORE && (
          <form
            autoComplete="off"
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => setListStore(list.id, "", newStoreName),
                () => {
                  setNewStoreName("");
                  setStoreChoice(null);
                },
              );
            }}
          >
            <Input
              autoFocus
              autoComplete="off"
              placeholder="Nombre del supermercado"
              className="h-10"
              maxLength={60}
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
            />
            <Button type="submit" className="h-10" disabled={pending || !newStoreName.trim()}>
              Usar
            </Button>
          </form>
        )}
      </div>

      {/* Resumen del carrito */}
      {cartItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="En el carrito" value={money(total)} />
          <Stat label="Ahorras" value={money(saved)} className="text-income" />
          <Stat label="Más barato en otro" value={money(missed)} className={missed > 0 ? "text-amber-600 dark:text-amber-400" : ""} />
        </div>
      )}

      {!list.completed && (
        <ProductPicker
          products={products}
          excludeIds={items.map((i) => i.productId)}
          pending={pending}
          placeholder="Agregar a la lista…"
          onPick={(picked: PickedProduct) => run(() => addItem(list.id, picked))}
        />
      )}

      {pendingItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Por comprar</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {pendingItems.map((item) => {
              const reference = references[item.productId];
              const best = reference ? bestRegular(reference) : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    onClick={() => setOpenItemId(item.id)}
                  >
                    <span className="size-6 shrink-0 rounded-full border-2" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.name}
                        {item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          item.note,
                          best
                            ? `Mejor: ${best.storeName} · ${formatUnitPrice(best.unitCents, item.unit, currency)}`
                            : "Sin precios anteriores",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cartItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">En el carrito</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {cartItems.map((item) => {
              const reference = references[item.productId];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    onClick={() => setOpenItemId(item.id)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.price
                              ? [
                                  item.price.brand,
                                  formatPack(item.price.sizeEach, item.price.packCount, item.unit),
                                  item.price.onSale ? "oferta" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : "Sin precio"}
                          </p>
                        </div>
                        {item.price && (
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">{money(item.price.priceCents * item.quantity)}</p>
                            {item.quantity > 1 && (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {item.quantity} × {money(item.price.priceCents)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {item.price && reference && list.storeId && (
                        <PriceVerdict
                          compact
                          reference={reference}
                          storeId={list.storeId}
                          priceCents={item.price.priceCents}
                          totalSize={item.price.sizeEach * item.price.packCount}
                          quantity={item.quantity}
                          currency={currency}
                        />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Agrega lo que vas a comprar. En el súper toca cada producto para anotar su precio.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t pt-5">
        <Button
          variant={list.completed ? "outline" : "default"}
          className="h-10"
          disabled={pending}
          onClick={() => run(() => setListCompleted(list.id, !list.completed))}
        >
          {list.completed ? "Reabrir lista" : "Terminar compra"}
        </Button>
        <Button
          variant="ghost"
          className="h-10 text-destructive"
          disabled={pending}
          onClick={() => {
            if (confirm("¿Eliminar la lista? Los precios anotados se quedan en el comparador.")) {
              run(() => deleteList(list.id));
            }
          }}
        >
          Eliminar lista
        </Button>
      </div>

      <Sheet open={openItem !== null} onOpenChange={(open) => !open && setOpenItemId(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {openItem && (
            <MarkItemForm
              key={openItem.id}
              item={openItem}
              storeId={list.storeId}
              storeName={storeName}
              reference={references[openItem.productId]}
              currency={currency}
              pending={pending}
              onMark={(quantity, note, draft) =>
                run(() => markItem(openItem.id, { quantity, note, draft }), () => setOpenItemId(null))
              }
              onUncheck={() => run(() => uncheckItem(openItem.id), () => setOpenItemId(null))}
              onRemove={() => run(() => removeItem(openItem.id), () => setOpenItemId(null))}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Panel para anotar el precio de un producto en la percha y ver al momento si conviene.
function MarkItemForm({
  item,
  storeId,
  storeName,
  reference,
  currency,
  pending,
  onMark,
  onUncheck,
  onRemove,
}: {
  item: ListItem;
  storeId: string | null;
  storeName: string | null;
  reference: ProductReference | undefined;
  currency: string;
  pending: boolean;
  onMark: (quantity: number, note: string, draft: PriceDraft | null) => void;
  onUncheck: () => void;
  onRemove: () => void;
}) {
  // Lo último visto aquí: marca y medida para no escribirlas otra vez.
  const lastHere = reference?.stores.find((s) => s.storeId === storeId)?.regular ?? null;
  const [draft, setDraft] = useState<PriceDraft>(() => {
    const base = item.price ?? lastHere;
    if (!base) return emptyDraft(item.unit);
    // En unidades no hay "× paquete": se muestra el total (4 rollos = 4).
    const isUnit = item.unit === "UNIT";
    const size = fromBaseSize(isUnit ? base.sizeEach * base.packCount : base.sizeEach, item.unit);
    return {
      brand: base.brand ?? "",
      sizeValue: size.value,
      sizeUnit: size.unit,
      packCount: isUnit ? "1" : String(base.packCount),
      price: item.price ? String(item.price.priceCents / 100).replace(".", ",") : "",
      onSale: item.price?.onSale ?? false,
      regularPrice: item.price?.regularPriceCents ? String(item.price.regularPriceCents / 100).replace(".", ",") : "",
    };
  });
  const [quantity, setQuantity] = useState(item.quantity);
  const [note, setNote] = useState(item.note ?? "");
  const parsed = parseDraft(draft, item.unit);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4">
      <SheetHeader className="px-0">
        <SheetTitle>{item.name}</SheetTitle>
        <SheetDescription>
          {storeName ? `Precio en ${storeName}` : "Elige primero en qué supermercado estás para anotar el precio."}
          {lastHere && !item.price ? ` · La última vez: ${formatAmount(lastHere.priceCents, currency)}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-center justify-between">
        <Label>Cantidad</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Menos"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <MinusIcon />
          </Button>
          <span className="w-6 text-center font-semibold tabular-nums">{quantity}</span>
          <Button type="button" variant="outline" size="icon" aria-label="Más" onClick={() => setQuantity((q) => q + 1)}>
            <PlusIcon />
          </Button>
        </div>
      </div>

      {storeId && (
        <PriceFields
          draft={draft}
          onChange={setDraft}
          unit={item.unit}
          currency={currency}
          idPrefix="mark"
          autoFocusPrice={!item.price}
        />
      )}

      {storeId && reference && !("error" in parsed) && (
        <PriceVerdict
          reference={reference}
          storeId={storeId}
          priceCents={parsed.priceCents}
          totalSize={parsed.sizeEach * parsed.packCount}
          quantity={quantity}
          currency={currency}
        />
      )}

      <Input
        aria-label="Nota"
        autoComplete="off"
        placeholder="Nota (opcional): el grande, sin lactosa…"
        className="h-10"
        maxLength={100}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2">
        {storeId && (
          <Button
            className="h-11"
            disabled={pending}
            onClick={() => {
              if ("error" in parsed) return setError(parsed.error);
              setError(null);
              onMark(quantity, note, draft);
            }}
          >
            {item.checked ? "Guardar" : "Al carrito"}
            {!("error" in parsed) && ` · ${formatAmount(parsed.priceCents * quantity, currency)}`}
          </Button>
        )}
        <Button variant="outline" className="h-10" disabled={pending} onClick={() => onMark(quantity, note, null)}>
          {item.checked ? "Guardar sin precio" : "Al carrito sin precio"}
        </Button>
        <div className={cn("grid gap-2", item.checked ? "grid-cols-2" : "grid-cols-1")}>
          {item.checked && (
            <Button variant="ghost" className="h-10" disabled={pending} onClick={onUncheck}>
              Sacar del carrito
            </Button>
          )}
          <Button variant="ghost" className="h-10 text-destructive" disabled={pending} onClick={onRemove}>
            Quitar de la lista
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold tabular-nums sm:text-base", className)}>{value}</p>
    </div>
  );
}
