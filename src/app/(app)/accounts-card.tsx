"use client";

import { useState } from "react";

import { Donut, type DonutSlice } from "@/components/donut";
import { Segmented } from "@/components/segmented";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

export type AccountType = "CASH" | "BANK" | "SAVINGS" | "CREDIT_CARD";
export type AccountRow = { id: string; name: string; type: AccountType; balanceCents: number; currency: string };

// Grupos de la pestaña "Por tipo", en este orden.
const TYPE_GROUPS: { type: AccountType; label: string }[] = [
  { type: "CASH", label: "Efectivo" },
  { type: "BANK", label: "Bancos" },
  { type: "SAVINGS", label: "Ahorro" },
  { type: "CREDIT_CARD", label: "Tarjetas de crédito" },
];

// 8 colores validados (globals.css --cat-1…8): nunca se repiten. Con más de 8 cuentas con
// saldo, las 7 de MÁS saldo tienen porción propia y el resto se agrupa en "Otras".
const COLORS = 8;
const OTHER_COLOR = "var(--muted-foreground)";

const percent = (value: number, total: number) =>
  new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 }).format(total ? value / total : 0);

// Cuentas del inicio: en lista o en gráfico de torta (cómo se reparte el dinero entre cuentas).
export function AccountsCard({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  const [view, setView] = useState<"list" | "chart" | "type">("list");

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle>Cuentas</CardTitle>
        <Segmented
          label="Ver cuentas como"
          value={view}
          onChange={setView}
          className="w-60"
          options={[
            { value: "list", label: "Lista" },
            { value: "chart", label: "Gráfico" },
            { value: "type", label: "Por tipo" },
          ]}
        />
      </CardHeader>
      {view === "type" ? (
        <AccountsByType accounts={accounts} currency={currency} />
      ) : view === "list" ? (
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

// Torta por tipo de cuenta: cuánto dinero hay en efectivo, en el banco y en ahorro. Cada tipo
// tiene siempre el mismo color. Un tipo con total negativo (tarjetas con deuda) va aparte.
const TYPE_COLORS: Record<AccountType, string> = {
  CASH: "var(--cat-1)",
  BANK: "var(--cat-2)",
  SAVINGS: "var(--cat-3)",
  CREDIT_CARD: "var(--cat-4)",
};

function AccountsByType({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  const groups = TYPE_GROUPS.map((g) => {
    const items = accounts.filter((a) => a.type === g.type);
    return { ...g, items, total: items.reduce((s, a) => s + a.balanceCents, 0) };
  }).filter((g) => g.items.length > 0);
  const list = (items: AccountRow[]) =>
    items.map((a) => `${a.name} ${formatAmount(a.balanceCents, a.currency)}`).join(", ");

  const slices: ChartSlice[] = groups
    .filter((g) => g.total > 0)
    .map((g) => ({
      key: g.type,
      label: `${g.label} (${g.items.length})`,
      value: g.total,
      color: TYPE_COLORS[g.type],
      detail: list(g.items),
    }))
    .sort((x, y) => y.value - x.value);
  const negative = groups.filter((g) => g.total < 0);

  return (
    <ShareChart
      slices={slices}
      currency={currency}
      title="Reparto del dinero por tipo de cuenta"
      empty="Ningún tipo de cuenta tiene saldo positivo para mostrar en el gráfico."
    >
      {negative.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sin incluir (en negativo):{" "}
          {negative.map((g, i) => (
            <span key={g.type}>
              {i > 0 && "; "}
              {g.label} <span className="text-expense tabular-nums">{formatAmount(g.total, currency)}</span> (
              {list(g.items)})
            </span>
          ))}
          .
        </p>
      )}
    </ShareChart>
  );
}

function AccountsChart({ accounts, currency }: { accounts: AccountRow[]; currency: string }) {
  // Una torta solo reparte cantidades positivas: las deudas (tarjeta en negativo) van aparte.
  const positive = accounts.filter((a) => a.balanceCents > 0);
  const negative = accounts.filter((a) => a.balanceCents < 0);

  // Las de más saldo tienen porción propia; si no caben todas, el resto va a "Otras".
  const byBalance = [...positive].sort((a, b) => b.balanceCents - a.balanceCents);
  const ownSlice = positive.length > COLORS ? byBalance.slice(0, COLORS - 1) : byBalance;
  const others = positive.length > COLORS ? byBalance.slice(COLORS - 1) : [];
  // Color por cuenta según su orden de creación (no por su puesto en el ranking).
  const shown = positive.filter((a) => ownSlice.includes(a));

  // Se muestran de mayor a menor saldo, pero cada una con el color que le tocó arriba.
  const slices: ChartSlice[] = shown
    .map((a, i) => ({ key: a.id, label: a.name, value: a.balanceCents, color: `var(--cat-${i + 1})` }))
    .sort((x, y) => y.value - x.value);
  if (others.length > 0) {
    slices.push({
      key: "other",
      label: `Otras (${others.length})`,
      value: others.reduce((s, a) => s + a.balanceCents, 0),
      color: OTHER_COLOR,
      detail: others.map((a) => `${a.name} ${formatAmount(a.balanceCents, a.currency)}`).join(", "),
    });
  }

  return (
    <ShareChart
      slices={slices}
      currency={currency}
      title="Reparto del dinero entre cuentas"
      empty="Ninguna cuenta tiene saldo positivo para mostrar en el gráfico."
    >
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
    </ShareChart>
  );
}

type ChartSlice = DonutSlice & { detail?: string }; // detail: qué cuentas incluye la porción

// Torta + leyenda (color, nombre, monto, %). Tocar una porción o una fila la muestra en el centro.
function ShareChart({
  slices,
  currency,
  title,
  empty,
  children,
}: {
  slices: ChartSlice[];
  currency: string;
  title: string;
  empty: string;
  children?: React.ReactNode; // notas debajo (lo que no entra en la torta)
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const activeSlice = slices.find((s) => s.key === active);

  if (slices.length === 0) {
    return (
      <div className="flex flex-col gap-3 border-t px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">{empty}</p>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t px-4 py-4">
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
