"use client";

import {
  CalendarIcon,
  CheckIcon,
  ClipboardListIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ShoppingCartIcon,
  StoreIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/native-select";
import { BranchInput } from "@/components/prices/branch-input";
import { PriceFields } from "@/components/prices/price-fields";
import { PriceVerdict } from "@/components/prices/price-verdict";
import { type PickedProduct, ProductPicker } from "@/components/prices/product-picker";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, parseDateInput } from "@/lib/dates";
import { centsToInput, formatAmount, parseAmountToCents } from "@/lib/money";
import { evaluatePrice, formatPercent, type ProductReference } from "@/lib/price-compare";
import { emptyDraft, type PriceDraft, parseDraft } from "@/lib/price-draft";
import { estimateLabel, type ItemEstimate, itemEstimate } from "@/lib/shopping-estimate";
import { formatPack, fromBaseSize, type ProductUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

import {
  addItem,
  deleteList,
  markItem,
  planItem,
  removeItem,
  renameList,
  setListBranch,
  setListCompleted,
  setListPlannedDate,
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
  estimateCents: number | null; // tu estimado por paquete (null = usar el último precio)
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

type Mode = "plan" | "shop";
const NEW_STORE = "__new__";

export function ShoppingView({
  list,
  items,
  stores,
  branches,
  products,
  references,
  currency,
}: {
  list: {
    id: string;
    name: string;
    storeId: string | null;
    branch: string | null;
    plannedDate: string | null; // "2026-10-18" (tentativa)
    completed: boolean;
  };
  branches: Record<string, string[]>;
  items: ListItem[];
  stores: { id: string; name: string }[];
  products: { id: string; name: string; unit: ProductUnit }[];
  references: Record<string, ProductReference>;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // Planificar (en casa) o En el súper (marcando precios). Si ya hay algo en el carrito, en el súper.
  const [mode, setMode] = useState<Mode>(list.completed || items.some((i) => i.checked) ? "shop" : "plan");
  // Solo mientras se escribe un supermercado nuevo; si no, se muestra el de la lista.
  const [storeChoice, setStoreChoice] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [branch, setBranch] = useState(list.branch ?? "");
  const money = (cents: number) => formatAmount(cents, currency);

  const run = (action: () => Promise<{ error: string | null }>, done?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else done?.();
    });

  const storeName = stores.find((s) => s.id === list.storeId)?.name ?? null;
  const estimateOf = (item: ListItem) => itemEstimate(item.estimateCents, references[item.productId], list.storeId);
  const pendingItems = items.filter((i) => !i.checked);
  const cartItems = items.filter((i) => i.checked);

  // Totales: estimado de toda la lista y, en el súper, lo real del carrito.
  let estimatedTotal = 0;
  let withoutEstimate = 0;
  let cartTotal = 0;
  let cartEstimated = 0; // lo que se había estimado para lo que ya está en el carrito
  let remainingEstimate = 0;
  let saved = 0;
  let missed = 0;
  for (const item of items) {
    const estimate = estimateOf(item);
    if (estimate.cents === null) withoutEstimate++;
    else estimatedTotal += estimate.cents * item.quantity;
    if (!item.checked) {
      if (estimate.cents !== null) remainingEstimate += estimate.cents * item.quantity;
      continue;
    }
    const actual = item.price?.priceCents ?? estimate.cents;
    if (actual !== null) cartTotal += actual * item.quantity;
    if (item.price && estimate.cents !== null) cartEstimated += estimate.cents * item.quantity;
    const reference = references[item.productId];
    if (!item.price || !reference || !list.storeId) continue;
    const verdict = evaluatePrice(reference, {
      storeId: list.storeId,
      priceCents: item.price.priceCents,
      totalSize: item.price.sizeEach * item.price.packCount,
    });
    if (verdict.kind === "best") saved += verdict.savingsCents * item.quantity;
    if (verdict.kind === "worse") missed += verdict.extraCents * item.quantity;
  }
  const cartWithPrice = cartItems.filter((i) => i.price && estimateOf(i).cents !== null);
  const cartPriced = cartWithPrice.reduce((s, i) => s + i.price!.priceCents * i.quantity, 0);
  const vsEstimate = cartPriced - cartEstimated; // >0: más caro de lo estimado

  function chooseStore(value: string) {
    if (value === NEW_STORE) return setStoreChoice(NEW_STORE);
    setStoreChoice(null);
    // Otra cadena: la sucursal anterior ya no vale.
    if (value && value !== list.storeId) setBranch("");
    if (value) run(() => setListStore(list.id, value, ""));
  }

  function saveBranch() {
    if (branch.trim() !== (list.branch ?? "")) run(() => setListBranch(list.id, branch));
  }

  const openItem = items.find((i) => i.id === openItemId) ?? null;
  const planned = list.plannedDate
    ? formatDate(parseDateInput(list.plannedDate)!, { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Cabecera: nombre, fecha tentativa y total. */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
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
              {[
                planned ? `Para el ${planned} (tentativo)` : null,
                storeName ? `${storeName}${list.branch ? ` · ${list.branch}` : ""}` : null,
                list.completed ? "Terminada" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Sin fecha ni supermercado"}
            </p>
          </div>
        </div>

        {mode === "plan" || cartItems.length === 0 ? (
          <div>
            <p className="text-sm text-muted-foreground">Gasto estimado</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {items.length === 1 ? "1 producto" : `${items.length} productos`}
              {withoutEstimate > 0 &&
                ` · ${withoutEstimate} sin estimado (no suma${withoutEstimate === 1 ? "" : "n"})`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground">En el carrito</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{money(cartTotal)}</p>
              {cartWithPrice.length > 0 && Math.abs(vsEstimate) >= 1 && (
                <p className={cn("text-xs font-medium", vsEstimate > 0 ? "text-expense" : "text-income")}>
                  {money(Math.abs(vsEstimate))} {vsEstimate > 0 ? "más" : "menos"} de lo estimado
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{list.completed ? "Estimado total" : "Falta (estimado)"}</p>
              <p className="text-2xl font-semibold tracking-tight text-muted-foreground tabular-nums">
                {money(list.completed ? estimatedTotal : remainingEstimate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingItems.length} por comprar · total aprox. {money(cartTotal + remainingEstimate)}
              </p>
            </div>
            {(saved > 0 || missed > 0) && (
              <p className="col-span-2 text-xs text-muted-foreground">
                {saved > 0 && <span className="font-medium text-income">Ahorras {money(saved)}</span>}
                {saved > 0 && missed > 0 && " · "}
                {missed > 0 && (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {money(missed)} más barato en otros súper
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {!list.completed && (
          <Segmented
            label="Modo"
            value={mode}
            onChange={setMode}
            options={[
              { value: "plan", label: "Planificar" },
              { value: "shop", label: "En el súper" },
            ]}
          />
        )}
      </section>

      {/* Dónde y cuándo. */}
      {!list.completed && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-store" className="flex items-center gap-1.5">
              <StoreIcon className="size-4" />
              {mode === "plan" ? "¿Dónde piensas comprar? (opcional)" : "¿Dónde estás comprando?"}
            </Label>
            <NativeSelect
              id="list-store"
              value={storeChoice ?? list.storeId ?? ""}
              onChange={(e) => chooseStore(e.target.value)}
              disabled={pending}
            >
              {!list.storeId && <option value="">Elige el supermercado…</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NEW_STORE}>+ Otro supermercado (nuevo)…</option>
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
                  placeholder="Nombre del supermercado o comercio"
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
            {list.storeId && storeChoice !== NEW_STORE && (
              <BranchInput
                value={branch}
                onChange={setBranch}
                onBlur={saveBranch}
                suggestions={branches[list.storeId] ?? []}
              />
            )}
          </div>
          {mode === "plan" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="list-date" className="flex items-center gap-1.5">
                <CalendarIcon className="size-4" /> Fecha tentativa (opcional)
              </Label>
              <Input
                // Se recrea al guardarse una fecha nueva (su valor inicial no puede cambiar después).
                key={list.plannedDate ?? "sin-fecha"}
                id="list-date"
                type="date"
                autoComplete="off"
                className="h-10"
                defaultValue={list.plannedDate ?? ""}
                onChange={(e) => run(() => setListPlannedDate(list.id, e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Solo de referencia: puedes ir otro día.</p>
            </div>
          )}
        </section>
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

      {/* Productos. */}
      {pendingItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground">
            <ClipboardListIcon className="size-4" /> Por comprar ({pendingItems.length})
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {pendingItems.map((item) => {
              const estimate = estimateOf(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    onClick={() => setOpenItemId(item.id)}
                  >
                    {mode === "shop" && <span className="size-6 shrink-0 rounded-full border-2" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.name}
                        {item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.note, estimate.cents !== null ? estimateLabel(estimate) : null]
                          .filter(Boolean)
                          .join(" · ") || " "}
                      </p>
                    </div>
                    {estimate.cents !== null ? (
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{money(estimate.cents * item.quantity)}</span>
                        {item.quantity > 1 && (
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {item.quantity} × {money(estimate.cents)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Poner estimado
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cartItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground">
            <ShoppingCartIcon className="size-4" /> En el carrito ({cartItems.length})
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {cartItems.map((item) => {
              const reference = references[item.productId];
              const estimate = estimateOf(item);
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
                              : "Sin precio anotado"}
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
                      {item.price && <EstimateVerdict compact estimate={estimate} priceCents={item.price.priceCents} currency={currency} />}
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
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Agrega lo que vas a comprar. Para los productos que nunca compraste, toca el producto y escribe cuánto
          crees que cuesta: así sabrás cuánto te llevará la compra.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t pt-5">
        {(mode === "shop" || list.completed) && (
          <Button
            variant={list.completed ? "outline" : "default"}
            className="h-10"
            disabled={pending}
            onClick={() => run(() => setListCompleted(list.id, !list.completed))}
          >
            {list.completed ? "Reabrir lista" : "Terminar compra"}
          </Button>
        )}
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
          {openItem &&
            (mode === "plan" && !openItem.checked ? (
              <PlanItemForm
                key={openItem.id}
                item={openItem}
                estimate={estimateOf(openItem)}
                suggested={itemEstimate(null, references[openItem.productId], list.storeId)}
                currency={currency}
                pending={pending}
                onSave={(input) => run(() => planItem(openItem.id, input), () => setOpenItemId(null))}
                onRemove={() => run(() => removeItem(openItem.id), () => setOpenItemId(null))}
              />
            ) : (
              <MarkItemForm
                key={openItem.id}
                item={openItem}
                storeId={list.storeId}
                storeName={storeName && list.branch ? `${storeName} · ${list.branch}` : storeName}
                reference={references[openItem.productId]}
                estimate={estimateOf(openItem)}
                currency={currency}
                pending={pending}
                onMark={(quantity, note, draft) =>
                  run(() => markItem(openItem.id, { quantity, note, draft }), () => setOpenItemId(null))
                }
                onUncheck={() => run(() => uncheckItem(openItem.id), () => setOpenItemId(null))}
                onRemove={() => run(() => removeItem(openItem.id), () => setOpenItemId(null))}
              />
            ))}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label>Cantidad</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Menos"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          <MinusIcon />
        </Button>
        <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon" aria-label="Más" onClick={() => onChange(value + 1)}>
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

// Planificar un producto: cantidad, nota y cuánto calculas que cuesta cada uno.
function PlanItemForm({
  item,
  estimate,
  suggested,
  currency,
  pending,
  onSave,
  onRemove,
}: {
  item: ListItem;
  estimate: ItemEstimate;
  suggested: ItemEstimate; // el último precio visto (sin contar tu estimado)
  currency: string;
  pending: boolean;
  onSave: (input: { quantity: number; note: string; estimate: string }) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [note, setNote] = useState(item.note ?? "");
  const [value, setValue] = useState(item.estimateCents !== null ? centsToInput(BigInt(item.estimateCents)) : "");
  const typed = value.trim() ? parseAmountToCents(value) : null;
  const perUnit = typed !== null ? Number(typed) : suggested.cents;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4">
      <SheetHeader className="px-0">
        <SheetTitle>{item.name}</SheetTitle>
        <SheetDescription>
          {suggested.cents !== null
            ? `${estimateLabel(suggested)}: ${formatAmount(suggested.cents, currency)}`
            : "Nunca lo has comprado: escribe cuánto crees que cuesta."}
        </SheetDescription>
      </SheetHeader>

      <QuantityStepper value={quantity} onChange={setQuantity} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-estimate">Tu estimado por unidad ({currency})</Label>
        <Input
          id="plan-estimate"
          inputMode="decimal"
          autoComplete="off"
          placeholder={suggested.cents !== null ? centsToInput(BigInt(suggested.cents)) : "0,00"}
          className="h-10 text-lg font-semibold tabular-nums"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {suggested.cents !== null
            ? "Déjalo vacío para usar el último precio visto."
            : "Opcional, pero sin estimado este producto no suma al total."}
        </p>
      </div>

      <Input
        aria-label="Nota"
        autoComplete="off"
        placeholder="Nota (opcional): el grande, sin lactosa…"
        className="h-10"
        maxLength={100}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {perUnit !== null && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Estimado: <span className="font-semibold tabular-nums">{formatAmount(perUnit * quantity, currency)}</span>
          {quantity > 1 && ` (${quantity} × ${formatAmount(perUnit, currency)})`}
        </p>
      )}
      {estimate.source === "mine" && !value.trim() && (
        <p className="text-xs text-muted-foreground">Se quitará tu estimado y se usará el último precio.</p>
      )}

      <div className="flex flex-col gap-2">
        <Button className="h-11" disabled={pending} onClick={() => onSave({ quantity, note, estimate: value })}>
          Guardar
        </Button>
        <Button variant="ghost" className="h-10 text-destructive" disabled={pending} onClick={onRemove}>
          Quitar de la lista
        </Button>
      </div>
    </div>
  );
}

// Precio real frente a lo estimado: "Igual a tu estimado", "12 % más caro que tu estimado"…
function EstimateVerdict({
  estimate,
  priceCents,
  currency,
  compact = false,
}: {
  estimate: ItemEstimate;
  priceCents: number;
  currency: string;
  compact?: boolean;
}) {
  if (estimate.cents === null) return null;
  const diff = priceCents - estimate.cents;
  const share = diff / estimate.cents;
  const whose = estimate.source === "mine" ? "tu estimado" : "lo estimado";
  const text =
    Math.abs(share) < 0.01
      ? `Igual a ${whose} (${formatAmount(estimate.cents, currency)})`
      : `${formatPercent(Math.abs(share))} ${diff > 0 ? "más caro" : "más barato"} que ${whose} (${formatAmount(estimate.cents, currency)})`;
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        compact && "px-2 py-1 text-xs",
        Math.abs(share) < 0.01
          ? "bg-muted text-muted-foreground"
          : diff > 0
            ? "bg-expense/10 text-expense"
            : "bg-income/10 text-income",
      )}
    >
      {text}
    </p>
  );
}

// En el súper: anotar el precio de la percha y ver al momento si conviene.
function MarkItemForm({
  item,
  storeId,
  storeName,
  reference,
  estimate,
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
  estimate: ItemEstimate;
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
          {estimate.cents !== null ? ` · ${estimateLabel(estimate)}: ${formatAmount(estimate.cents, currency)}` : ""}
        </SheetDescription>
      </SheetHeader>

      <QuantityStepper value={quantity} onChange={setQuantity} />

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

      {/* Frente a lo que estimaste y frente a otros supermercados. */}
      {storeId && !("error" in parsed) && (
        <EstimateVerdict estimate={estimate} priceCents={parsed.priceCents} currency={currency} />
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
