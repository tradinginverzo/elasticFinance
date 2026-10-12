"use client";

import { useState } from "react";

import { Segmented } from "@/components/segmented";
import { type ChartSlice, ShareChart } from "@/components/share-chart";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Tortas de gastos e ingresos por categoría de los movimientos que se están viendo.
// En el PC van lado a lado; en el iPhone se elige una con el selector (para no empujar la lista).
export function CategoryCharts({
  expenses,
  incomes,
  currency,
}: {
  expenses: ChartSlice[];
  incomes: ChartSlice[];
  currency: string;
}) {
  const [mobileView, setMobileView] = useState<"EXPENSE" | "INCOME">(expenses.length > 0 ? "EXPENSE" : "INCOME");
  if (expenses.length === 0 && incomes.length === 0) return null;

  const charts = [
    { type: "EXPENSE" as const, title: "Gastos por categoría", slices: expenses, empty: "No hay gastos." },
    { type: "INCOME" as const, title: "Ingresos por categoría", slices: incomes, empty: "No hay ingresos." },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Ver por categoría"
        value={mobileView}
        onChange={setMobileView}
        className="md:hidden"
        options={[
          { value: "EXPENSE", label: "Gastos por categoría" },
          { value: "INCOME", label: "Ingresos por categoría" },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {charts.map((c) => (
          // En el iPhone el título va en el selector: la tarjeta empieza directo con el gráfico.
          <Card key={c.type} className={cn("gap-0 pt-0 pb-0 md:pt-6", mobileView !== c.type && "hidden md:flex")}>
            <CardHeader className="hidden pb-3 md:grid">
              <CardTitle>{c.title}</CardTitle>
            </CardHeader>
            <ShareChart
              slices={c.slices}
              currency={currency}
              title={c.title}
              empty={c.empty}
              centerLabel={c.type === "EXPENSE" ? "Gastos" : "Ingresos"}
              className="border-t-0 md:border-t"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
