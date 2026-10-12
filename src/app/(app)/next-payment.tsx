"use client";

import { CalendarClockIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseDateInput, todayInput } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export type IncomeSchedule = {
  templateId: string;
  name: string;
  amountCents: number;
  lastDate: string | null; // "2026-10-04"; null si nunca se registró
  nextDate: string | null; // fecha estimada: último registro + 1 mes
};

// "Hoy" según el reloj del teléfono (el servidor puede estar en otra zona horaria). En el
// servidor no hay "hoy" del usuario: ahí se usa el del servidor y se corrige al cargar.
function useToday() {
  return useSyncExternalStore(
    () => () => {},
    () => todayInput(),
    () => todayInput(),
  );
}

const day = (d: string) => parseDateInput(d)!.getTime();

// Próximos pagos de los ingresos fijos (sueldo, arriendo que cobras…): cuántos días faltan y
// la fecha estimada (último registro + 1 mes). Primero el que llega antes.
export function NextPayments({ incomes, currency }: { incomes: IncomeSchedule[]; currency: string }) {
  const today = useToday();
  const sorted = [...incomes].sort(
    (a, b) => (a.nextDate ? day(a.nextDate) : Infinity) - (b.nextDate ? day(b.nextDate) : Infinity),
  );

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-primary" />
          {incomes.length === 1 ? "Próximo pago" : "Próximos pagos"}
        </CardTitle>
      </CardHeader>
      <ul className="divide-y border-t">
        {sorted.map((income) => (
          <IncomeRow key={income.templateId} income={income} today={today} currency={currency} />
        ))}
      </ul>
    </Card>
  );
}

function IncomeRow({ income, today, currency }: { income: IncomeSchedule; today: string; currency: string }) {
  const registerHref = `/movimientos/nuevo?fijo=${income.templateId}`;
  const title = (
    <p className="flex items-baseline justify-between gap-2">
      <span className="truncate font-medium">{income.name}</span>
      <span className="shrink-0 text-sm text-income tabular-nums">{formatAmount(income.amountCents, currency)}</span>
    </p>
  );

  if (!income.lastDate || !income.nextDate) {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {title}
          <p className="text-xs text-muted-foreground">Regístralo una vez para calcular cuándo llega el próximo.</p>
        </div>
        <Button size="sm" variant="outline" render={<Link href={registerHref} />} nativeButton={false}>
          Registrar
        </Button>
      </li>
    );
  }

  const daysLeft = Math.round((day(income.nextDate) - day(today)) / DAY_MS);
  const cycle = Math.max(1, Math.round((day(income.nextDate) - day(income.lastDate)) / DAY_MS));
  const elapsed = Math.min(Math.max(cycle - daysLeft, 0), cycle);
  const late = daysLeft < 0;
  const estimated = formatDate(parseDateInput(income.nextDate)!, { weekday: "short", day: "numeric", month: "short" });
  const last = formatDate(parseDateInput(income.lastDate)!, { day: "numeric", month: "short" });

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      {title}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xl font-semibold tracking-tight", late && "text-amber-700 dark:text-amber-400")}>
            {daysLeft > 1
              ? `Faltan ${daysLeft} días`
              : daysLeft === 1
                ? "Llega mañana"
                : daysLeft === 0
                  ? "Llega hoy"
                  : `Se esperaba hace ${-daysLeft} ${daysLeft === -1 ? "día" : "días"}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Fecha estimada: <span className="font-medium text-foreground">{estimated}</span> · último el {last}
          </p>
        </div>
        {/* Ya registrado en este ciclo: sin botón. Solo si se atrasó (o nunca se registró, arriba). */}
        {late && (
          <Button size="sm" variant="outline" render={<Link href={registerHref} />} nativeButton={false}>
            Registrar
          </Button>
        )}
      </div>
      {/* Cuánto del ciclo (de un pago al siguiente) ya pasó. */}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Días transcurridos desde el último pago de ${income.name}`}
        aria-valuemin={0}
        aria-valuemax={cycle}
        aria-valuenow={elapsed}
      >
        <div
          className={cn("h-full rounded-full", late ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${(elapsed / cycle) * 100}%` }}
        />
      </div>
    </li>
  );
}
