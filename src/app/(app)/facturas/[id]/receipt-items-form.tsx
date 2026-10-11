"use client";

import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { BranchInput } from "@/components/prices/branch-input";
import { PriceFields } from "@/components/prices/price-fields";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/lib/money";
import { type PriceDraft, parseDraft } from "@/lib/price-draft";
import { formatPack, PRODUCT_UNITS, type ProductUnit, SIZE_UNITS } from "@/lib/units";
import { cn } from "@/lib/utils";

import { saveReceiptItems, scanReceipt } from "../actions";

export type ReviewItem = {
  key: string;
  text: string;
  include: boolean;
  productId: string; // "" = producto nuevo
  newName: string;
  unit: ProductUnit;
  quantity: string;
  draft: PriceDraft;
};

const NEW = "__new__";

export function ReceiptItemsForm({
  receiptId,
  items: initialItems,
  products,
  stores,
  initialStoreId,
  initialStoreName,
  initialDate,
  initialBranch,
  branches,
  currency,
  saved,
}: {
  receiptId: string;
  items: ReviewItem[];
  products: { id: string; name: string; unit: ProductUnit }[];
  stores: { id: string; name: string }[];
  initialStoreId: string;
  initialStoreName: string;
  initialDate: string;
  initialBranch: string;
  branches: Record<string, string[]>;
  currency: string;
  saved: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [storeId, setStoreId] = useState(initialStoreId || NEW);
  const [newStoreName, setNewStoreName] = useState(initialStoreName);
  const [date, setDate] = useState(initialDate);
  const [branch, setBranch] = useState(initialBranch);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<ReviewItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const included = items.filter((i) => i.include);

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveReceiptItems(receiptId, {
            storeId: storeId === NEW ? "" : storeId,
            newStoreName,
            branch,
            date,
            items: included.map(({ text, productId, newName, unit, quantity, draft }) => ({
              text,
              productId,
              newName,
              unit,
              quantity,
              draft,
            })),
          });
          setError(result.error);
          if (!result.error) {
            toast.success(included.length === 1 ? "Precio guardado" : `${included.length} precios guardados`);
            router.push("/precios");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="receipt-store">Supermercado</Label>
          <NativeSelect id="receipt-store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW}>+ Otro supermercado…</option>
          </NativeSelect>
          {storeId === NEW && (
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
          <BranchInput
            value={branch}
            onChange={setBranch}
            suggestions={storeId === NEW ? [] : (branches[storeId] ?? [])}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="receipt-date">Fecha</Label>
          <Input
            id="receipt-date"
            type="date"
            autoComplete="off"
            className="h-10"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="font-medium">
          {included.length} de {items.length} productos
        </span>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => {
            const all = included.length < items.length;
            setItems((list) => list.map((i) => ({ ...i, include: all })));
          }}
        >
          {included.length < items.length ? "Marcar todos" : "Desmarcar todos"}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            products={products}
            currency={currency}
            onChange={(patch) => update(item.key, patch)}
          />
        ))}
      </ul>

      <FormError message={error} />
      <Button type="submit" className="h-11" disabled={pending || included.length === 0}>
        {pending
          ? "Guardando…"
          : `${saved ? "Volver a guardar" : "Guardar"} ${included.length} ${included.length === 1 ? "precio" : "precios"}`}
      </Button>
    </form>
  );
}

function ItemCard({
  item,
  products,
  currency,
  onChange,
}: {
  item: ReviewItem;
  products: { id: string; name: string; unit: ProductUnit }[];
  currency: string;
  onChange: (patch: Partial<ReviewItem>) => void;
}) {
  const parsed = parseDraft(item.draft, item.unit);
  const invalid = "error" in parsed;
  const [open, setOpen] = useState(item.include && invalid);
  const product = products.find((p) => p.id === item.productId);
  const name = product?.name ?? item.newName;

  // Al cambiar de producto (o de medida) la unidad escrita debe valer para la nueva medida.
  function setUnit(unit: ProductUnit) {
    const valid = SIZE_UNITS[unit].some((u) => u.value === item.draft.sizeUnit);
    onChange({
      unit,
      draft: { ...item.draft, sizeUnit: valid ? item.draft.sizeUnit : SIZE_UNITS[unit][0].value },
    });
  }

  return (
    <li className={cn("rounded-xl border bg-card", !item.include && "opacity-60")}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          aria-label={`Guardar ${name}`}
          className="mt-1 size-4 shrink-0 accent-primary"
          checked={item.include}
          onChange={(e) => onChange({ include: e.target.checked })}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <p className="truncate font-medium">
            {product ? name : <span>Nuevo: {name || "—"}</span>}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{item.text}</p>
          <p className={cn("truncate text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
            {invalid
              ? parsed.error
              : [
                  parsed.brand,
                  formatPack(parsed.sizeEach, parsed.packCount, item.unit),
                  `${formatAmount(parsed.priceCents, currency)}${item.quantity !== "1" ? ` × ${item.quantity}` : ""}`,
                  parsed.onSale ? "oferta" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </button>
        <button
          type="button"
          aria-label={open ? "Cerrar" : "Editar"}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t p-3">
          <div className="flex flex-col gap-2">
            <Label>Producto</Label>
            <NativeSelect
              aria-label="Producto"
              value={item.productId || NEW}
              onChange={(e) => {
                const id = e.target.value === NEW ? "" : e.target.value;
                const next = products.find((p) => p.id === id);
                onChange({ productId: id, newName: id ? "" : item.newName || name });
                if (next) setUnit(next.unit);
              }}
            >
              <option value={NEW}>Nuevo producto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            {!item.productId && (
              <>
                <Input
                  aria-label="Nombre del producto nuevo"
                  autoComplete="off"
                  className="h-10"
                  maxLength={60}
                  placeholder="Detergente líquido"
                  value={item.newName}
                  onChange={(e) => onChange({ newName: e.target.value })}
                />
                <Segmented
                  label="Cómo se mide"
                  value={item.unit}
                  onChange={setUnit}
                  options={PRODUCT_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                />
              </>
            )}
          </div>
          <PriceFields
            draft={item.draft}
            onChange={(draft) => onChange({ draft })}
            unit={item.unit}
            currency={currency}
            idPrefix={`item-${item.key}`}
          />
        </div>
      )}
    </li>
  );
}

// Para facturas leídas antes del comparador: volver a leerlas para sacar los productos.
export function ReadItemsButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await scanReceipt(receiptId);
          if (result.error) toast.error(result.error);
          router.refresh();
        })
      }
    >
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? "Leyendo productos…" : "Leer productos con IA"}
    </Button>
  );
}
