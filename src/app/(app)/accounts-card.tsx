"use client";

import { useState } from "react";

import { Donut, type DonutSlice } from "@/components/donut";
import { Segmented } from "@/components/segmented";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

export type AccountRow = { id: string; name: string; balanceCents: number; currency: string };

// 8 colores validados (globals.css --cat-1…8). Cada cuenta conserva el suyo por su orden de
// creación; si hay más de 8, de la 8.ª en adelante se agrupan en "Otras" (nunca se repiten colores).
const COLORS = 8;
const OTHER_COLOR = "var(--muted-foreground)";

const percent = (value: number, total: number) =>
  new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 }).format(total ? value / total : 0);

// Cuentas del inicio: en lista o en gráfico de torta (cómo se reparte el dinero entre cuentas).
export function AccountsCard({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  const [view, setView] = useState<"list" | "chart">("list");

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle>Cuentas</CardTitle>
        <Segmented
          label="Ver cuentas como"
          value={view}
          onChange={setView}
          className="w-44"
          options={[
            { value: "list", label: "Lista" },
            { value: "chart", label: "Gráfico" },
          ]}
        />
      </CardHeader>
      {view === "list" ? (
        <ul className="divide-y border-t">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate">{a.name}</span>
              <span className={cn("font-medium tabular-nums", a.balanceCents < 0 && "text-expense")}>
                {formatAmount(a.balanceCents, a.currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <AccountsChart accounts={accounts} currency={currency} />
      )}
    </Card>
  );
}

function AccountsChart({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  const [active, setActive] = useState<string | null>(null);

  // Color fijo por cuenta (según su orden), aunque luego no entre en el gráfico.
  const colored = accounts.map((a, i) => ({
    ...a,
    group: accounts.length > COLORS && i >= COLORS - 1 ? "other" : a.id,
    color: accounts.length > COLORS && i >= COLORS - 1 ? OTHER_COLOR : `var(--cat-${i + 1})`,
  }));
  // Una torta solo reparte cantidades positivas: las deudas (tarjeta en negativo) van aparte.
  const positive = colored.filter((a) => a.balanceCents > 0);
  const negative = colored.filter((a) => a.balanceCents < 0);

  const slices: DonutSlice[] = [];
  for (const a of positive) {
    const existing = slices.find((s) => s.key === a.group);
    if (existing) existing.value += a.balanceCents;
    else slices.push({ key: a.group, label: a.group === "other" ? "Otras" : a.name, value: a.balanceCents, color: a.color });
  }
  const total = slices.reduce((s, x) => s + x.value, 0);
  const activeSlice = slices.find((s) => s.key === active);

  if (slices.length === 0) {
    return (
      <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        Ninguna cuenta tiene saldo positivo para mostrar en el gráfico.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t px-4 py-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <Donut
          slices={slices}
          activeKey={active}
          onActiveChange={setActive}
          label={`Reparto del dinero entre cuentas: ${slices.map((s) => `${s.label} ${percent(s.value, total)}`).join(", ")}`}
        >
          {activeSlice ? (
            <>
              <span className="max-w-24 truncate text-xs text-muted-foreground">{activeSlice.label}</span>
              <span className="text-sm font-semibold">{formatAmount(activeSlice.value, currency)}</span>
              <span className="text-xs text-muted-foreground">{percent(activeSlice.value, total)}</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">Con saldo</span>
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
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                  active === s.key && "bg-muted",
                )}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="font-medium tabular-nums">{formatAmount(s.value, currency)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                  {percent(s.value, total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {negative.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sin incluir {negative.length === 1 ? "la cuenta" : "las cuentas"} en negativo:{" "}
          {negative.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ", "}
              {a.name} <span className="text-expense tabular-nums">{formatAmount(a.balanceCents, a.currency)}</span>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
