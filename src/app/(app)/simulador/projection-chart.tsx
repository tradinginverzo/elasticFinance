"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatAmount } from "@/lib/money";

export type ChartPoint = { label: string; baseline: number; withScenario: number };

const AXIS_FORMAT = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

const SERIES = [
  { key: "baseline", color: "var(--series-1)" },
  { key: "withScenario", color: "var(--series-2)" },
] as const;

// Saldo proyectado mes a mes: sin el escenario (serie 1) y con él (serie 2).
export function ProjectionChart({
  data,
  currency,
  labels,
}: {
  data: ChartPoint[];
  currency: string;
  labels: { baseline: string; withScenario: string };
}) {
  const last = data[data.length - 1];
  const hasNegative = data.some((d) => d.withScenario < 0 || d.baseline < 0);

  return (
    <figure className="flex flex-col gap-3">
      {/* Leyenda con el valor final de cada serie: la identidad nunca depende solo del color. */}
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {SERIES.map(({ key, color }) => (
          <span key={key} className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ background: color }} aria-hidden />
            <span className="text-muted-foreground">{labels[key]}</span>
            <span className="font-medium tabular-nums">{formatAmount(last[key], currency)}</span>
          </span>
        ))}
      </figcaption>

      <div className="h-60 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              // Sin la moneda para que quepa en el iPhone ("7,5 mil"); la leyenda ya la muestra.
              tickFormatter={(v: number) => AXIS_FORMAT.format(v / 100)}
            />
            {hasNegative && (
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeWidth={1} />
            )}
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium capitalize">{label}</p>
                    {SERIES.map(({ key, color }) => {
                      const value = payload.find((p) => p.dataKey === key)?.value;
                      return (
                        <p key={key} className="flex items-center gap-2">
                          <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
                          <span className="text-muted-foreground">{labels[key]}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums">
                            {typeof value === "number" ? formatAmount(value, currency) : "—"}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {SERIES.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2, fill: color }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
