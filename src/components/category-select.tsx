"use client";

import { useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Valor interno para "Sin categoría" (Base UI trata "" como "sin valor"). En el formulario se envía "".
const NONE = "__none__";

export type CategoryOption = { id: string; name: string; color: string | null };

// Selector de categoría con la insignia de color de cada una (un <select> nativo no admite
// colores). Envía el valor en un input oculto con `name`, como un campo normal del formulario.
export function CategorySelect({
  id,
  name,
  categories,
  defaultValue,
}: {
  id: string;
  name: string;
  categories: CategoryOption[];
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(
    defaultValue && categories.some((c) => c.id === defaultValue) ? defaultValue : NONE,
  );
  const selected = categories.find((c) => c.id === value);

  return (
    <>
      <input type="hidden" name={name} value={value === NONE ? "" : value} />
      <Select value={value} onValueChange={(next) => setValue((next as string | null) ?? NONE)}>
        <SelectTrigger id={id} className="h-10 w-full text-base md:text-sm">
          <SelectValue>
            {() => (
              <span className="flex min-w-0 items-center gap-2">
                <CategoryBadge name={selected?.name ?? null} color={selected?.color ?? null} />
                <span className="truncate">{selected?.name ?? "Sin categoría"}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <CategoryBadge name={null} color={null} />
            Sin categoría
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <CategoryBadge name={c.name} color={c.color} />
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
