"use client";

import { useState } from "react";

import { Segmented } from "@/components/segmented";
import { type ChartSlice, ShareChart } from "@/components/share-chart";
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
