"use client";

import { cn } from "@/lib/utils";

export type DonutSlice = {
  key: string;
  label: string;
  value: number; // positivo
  color: string; // un color de rol (p. ej. "var(--cat-1)")
};

// Gráfico de torta en forma de anillo (SVG). Las porciones van separadas por un hueco de 2 px
// del color de la tarjeta. Con `activeKey` resalta una porción y atenúa las demás.
export function Donut({
  slices,
  size = 160,
  thickness = 22,
  activeKey = null,
  onActiveChange,
  label,
  children,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  label: string; // descripción para lectores de pantalla
  children?: React.ReactNode; // texto en el centro
  className?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const visible = slices.filter((s) => s.value > 0);
  // Hueco entre porciones (solo si hay más de una).
  const gap = visible.length > 1 ? Math.min(2, circumference / visible.length / 4) : 0;

  // Cada porción empieza donde terminan las anteriores.
  const lengths = visible.map((s) => (s.value / total) * circumference);
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: Math.max(lengths[i] - gap, 0.5),
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
        onPointerLeave={() => onActiveChange?.(null)}
      >
        {/* Pista de fondo: se ve cuando no hay datos. */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.dash} ${circumference - a.dash}`}
            strokeDashoffset={-a.offset}
            className={cn(
              "transition-opacity",
              onActiveChange && "cursor-pointer",
              activeKey && activeKey !== a.key && "opacity-30",
            )}
            onPointerEnter={() => onActiveChange?.(a.key)}
            onClick={() => onActiveChange?.(activeKey === a.key ? null : a.key)}
          >
            <title>{a.label}</title>
          </circle>
        ))}
      </svg>
      {children && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
