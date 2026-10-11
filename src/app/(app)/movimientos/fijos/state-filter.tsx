"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { type State, STATES } from "./states";

// Pestañas Todos / Por pagar / Pagados. El listado ya está en la página: se filtra al instante
// ocultando filas con CSS (data-estado en el contenedor), sin volver a pedir nada al servidor.
// La dirección se actualiza igual (?estado=…) para conservarlo al volver atrás.
export function StateFilter({
  initial,
  counts,
  children,
}: {
  initial: State;
  counts: Record<State, number>;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>(initial);

  function choose(next: State) {
    setState(next);
    const url = next === "todos" ? "/movimientos/fijos" : `/movimientos/fijos?estado=${next}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div data-estado={state} className="group/fijos flex flex-col gap-6">
      <div role="tablist" aria-label="Filtrar por estado" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {STATES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={state === s.value}
            onClick={() => choose(s.value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1 truncate rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors",
              state === s.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {s.label}
            <span className="text-xs tabular-nums opacity-70">{counts[s.value]}</span>
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
