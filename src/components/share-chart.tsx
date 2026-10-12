"use client";

import { useState } from "react";

import { Donut, type DonutSlice } from "@/components/donut";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

export const percent = (value: number, total: number) =>
  new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 }).format(total ? value / total : 0);

export type ChartSlice = DonutSlice & { detail?: string }; // detail: qué incluye la porción

// Torta + leyenda (color, nombre, monto, %). Tocar una porción o una fila la muestra en el centro.
export function ShareChart({
  slices,
  currency,
  title,
  empty,
  centerLabel = "Con saldo",
  className,
  children,
}: {
  slices: ChartSlice[];
  currency: string;
  title: string;
  empty: string;
  centerLabel?: string; // texto sobre el total, en el centro
  className?: string;
  children?: React.ReactNode; // notas debajo (lo que no entra en la torta)
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const activeSlice = slices.find((s) => s.key === active);

  if (slices.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3 border-t px-4 py-6", className)}>
        <p className="text-center text-sm text-muted-foreground">{empty}</p>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 border-t px-4 py-4", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <Donut
          slices={slices}
          activeKey={active}
          onActiveChange={setActive}
          label={`${title}: ${slices.map((s) => `${s.label} ${percent(s.value, total)}`).join(", ")}`}
        >
          {activeSlice ? (
            <>
              <span className="max-w-24 truncate text-xs text-muted-foreground">{activeSlice.label}</span>
              <span className="text-sm font-semibold">{formatAmount(activeSlice.value, currency)}</span>
              <span className="text-xs text-muted-foreground">{percent(activeSlice.value, total)}</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{centerLabel}</span>
              <span className="text-sm font-semibold">{formatAmount(total, currency)}</span>
            </>
          )}
        </Donut>

        {/* Leyenda con nombre, monto y %: identifica cada porción sin depender del color. */}
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-1">
          {slices.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
                onClick={() => setActive(active === s.key ? null : s.key)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                  active === s.key && "bg-muted",
                )}
              >
                <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.label}</span>
                  {s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
                </span>
                <span className="font-medium tabular-nums">{formatAmount(s.value, currency)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                  {percent(s.value, total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {children}
    </div>
  );
}
