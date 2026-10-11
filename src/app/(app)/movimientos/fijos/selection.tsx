"use client";

import { XIcon } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { formatAmount } from "@/lib/money";

// Selección de gastos fijos por pagar para ver cuánto sumarían ("si pago agua y luz…").
// Las casillas van en las filas (que pinta el servidor) y la barra con el total, abajo.

type Selection = {
  selected: ReadonlyMap<string, number>; // id → monto habitual en centavos
  toggle: (id: string, cents: number) => void;
};

const SelectionContext = createContext<Selection | null>(null);

export function SelectionProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  const [selected, setSelected] = useState<ReadonlyMap<string, number>>(new Map());

  function toggle(id: string, cents: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, cents);
      return next;
    });
  }

  const total = [...selected.values()].reduce((s, c) => s + c, 0);

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      {children}
      {selected.size > 0 && (
        // Encima de la barra de navegación del móvil; abajo del todo en el PC.
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-4">
          <div
            role="status"
            className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-background/95 py-2.5 pr-2 pl-4 shadow-lg backdrop-blur"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {selected.size === 1 ? "1 seleccionado" : `${selected.size} seleccionados`}
              </p>
              <p className="text-lg font-semibold tabular-nums text-expense">{formatAmount(total, currency)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Map())}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
              Limpiar
            </button>
          </div>
        </div>
      )}
    </SelectionContext.Provider>
  );
}

// Casilla de una fila: suma o resta su monto habitual del total seleccionado.
export function SelectToggle({ id, amountCents, name }: { id: string; amountCents: number; name: string }) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Sumar ${name}`}
      className="size-5 shrink-0 accent-primary"
      checked={selection.selected.has(id)}
      onChange={() => selection.toggle(id, amountCents)}
    />
  );
}
