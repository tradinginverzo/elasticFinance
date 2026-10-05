"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { FormError } from "@/components/form-error";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

import { setCategoryColor } from "./actions";

type CategoryItem = { id: string; name: string; type: "EXPENSE" | "INCOME"; color: string | null };

const GROUPS = [
  { type: "EXPENSE", label: "Gastos" },
  { type: "INCOME", label: "Ingresos" },
] as const;

export function CategoryList({ categories: initial }: { categories: CategoryItem[] }) {
  // Estado local para que el cambio se vea al instante; el servidor valida que no se repita.
  const [categories, setCategories] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(category: CategoryItem, color: string) {
    const previous = category.color;
    setError(null);
    setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, color } : c)));
    startTransition(async () => {
      const result = await setCategoryColor(category.id, color);
      if (result.error) {
        setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, color: previous } : c)));
        setError({ id: category.id, message: result.error });
      } else {
        setOpenId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map(({ type, label }) => {
        const items = categories.filter((c) => c.type === type);
        if (items.length === 0) return null;
        return (
          <section key={type} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-medium text-muted-foreground">{label}</h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {items.map((category) => {
                const isOpen = openId === category.id;
                // Colores usados por OTRAS categorías del espacio: no se pueden repetir.
                const usedBy = new Map(
                  categories.filter((c) => c.id !== category.id && c.color).map((c) => [c.color!, c.name]),
                );
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : category.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    >
                      <CategoryBadge name={category.name} color={category.color} className="size-7 text-xs" />
                      <span className="flex-1 font-medium">{category.name}</span>
                      <span className="text-xs text-muted-foreground">{isOpen ? "Cerrar" : "Cambiar color"}</span>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-2 px-4 pb-4">
                        <div className="grid grid-cols-10 gap-2" role="radiogroup" aria-label={`Color de ${category.name}`}>
                          {CATEGORY_COLORS.map((color) => {
                            const owner = usedBy.get(color);
                            const selected = category.color === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={owner ? `Color usado por ${owner}` : "Color libre"}
                                title={owner ? `Ya lo usa «${owner}»` : undefined}
                                disabled={Boolean(owner) || pending}
                                onClick={() => choose(category, color)}
                                className={cn(
                                  "flex aspect-square items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform",
                                  selected && "ring-2 ring-foreground",
                                  owner ? "cursor-not-allowed opacity-25" : "hover:scale-110",
                                )}
                                style={{ backgroundColor: color }}
                              >
                                {selected && <CheckIcon className="size-3.5 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Los colores apagados ya los usa otra categoría.
                        </p>
                        {error?.id === category.id && <FormError message={error.message} />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
