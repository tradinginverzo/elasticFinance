"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRODUCT_UNITS, type ProductUnit } from "@/lib/units";

export type ProductOption = { id: string; name: string; unit: ProductUnit };

// Lo elegido: un producto existente o uno nuevo (nombre + tipo de medida).
export type PickedProduct = { id: string } | { name: string; unit: ProductUnit };

// Buscador de productos con opción de crear uno nuevo con lo que se escribió.
export function ProductPicker({
  products,
  onPick,
  placeholder = "Buscar o agregar producto…",
  excludeIds = [],
  pending = false,
}: {
  products: ProductOption[];
  onPick: (product: PickedProduct) => void;
  placeholder?: string;
  excludeIds?: string[];
  pending?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [unit, setUnit] = useState<ProductUnit>("UNIT");

  const text = query.trim().toLocaleLowerCase("es");
  const matches = text
    ? products
        .filter((p) => !excludeIds.includes(p.id) && p.name.toLocaleLowerCase("es").includes(text))
        .slice(0, 6)
    : [];
  const exact = products.some((p) => p.name.toLocaleLowerCase("es") === text);

  function pick(product: PickedProduct) {
    onPick(product);
    setQuery("");
    setCreating(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCreating(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 pl-8"
          disabled={pending}
        />
      </div>

      {text && !creating && (
        <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => pick({ id: p.id })}
              >
                {p.name}
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-muted"
                onClick={() => setCreating(true)}
              >
                <PlusIcon className="size-4" />
                Nuevo producto: «{query.trim()}»
              </button>
            </li>
          )}
        </ul>
      )}

      {creating && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          <p className="text-sm">
            ¿Cómo se mide <span className="font-medium">{query.trim()}</span>?
          </p>
          <Segmented
            label="Tipo de medida"
            value={unit}
            onChange={setUnit}
            options={PRODUCT_UNITS.map((u) => ({ value: u.value, label: u.label }))}
          />
          <p className="text-xs text-muted-foreground">
            {PRODUCT_UNITS.find((u) => u.value === unit)?.hint}. Así se comparan presentaciones de distinto tamaño.
          </p>
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={pending} onClick={() => pick({ name: query.trim(), unit })}>
              Agregar
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
