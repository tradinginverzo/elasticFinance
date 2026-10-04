"use client";

import { CheckIcon, ChevronRightIcon, PinIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, parseDateInput } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { TemplateOption } from "./transaction-form";

// A partir de cuántos gastos fijos mostramos el buscador.
const SEARCH_THRESHOLD = 7;

// Selector de gasto fijo del formulario "Nuevo movimiento": una línea compacta que abre un
// panel con los gastos fijos ordenados por estado (pendientes del mes primero).
export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  currency,
}: {
  templates: TemplateOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = templates.find((t) => t.id === selectedId);
  const pendingCount = templates.filter((t) => !t.registeredOn).length;

  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = normalized
    ? templates.filter((t) =>
        [t.name, t.categoryName, t.merchant].some((v) => v?.toLocaleLowerCase("es").includes(normalized)),
      )
    : templates;
  const pending = visible.filter((t) => !t.registeredOn);
  const registered = visible.filter((t) => t.registeredOn);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 py-2 pr-2 pl-3">
          <PinIcon className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Gasto fijo{selected.categoryName ? ` · ${selected.categoryName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => onSelect("")}
            aria-label="Dejar de usar este gasto fijo"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
        >
          <PinIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 font-medium">Usar un gasto fijo</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          // En pantallas táctiles no enfocamos el buscador al abrir: sacaría el teclado y taparía la lista.
          initialFocus={(interaction) => interaction !== "touch"}
          className="mx-auto max-h-[85dvh] w-full max-w-lg gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b pb-3">
            <SheetTitle>Gastos fijos</SheetTitle>
            <SheetDescription>Elige uno para rellenar el movimiento. Podrás cambiar el monto.</SheetDescription>
            {templates.length >= SEARCH_THRESHOLD && (
              <div className="relative mt-2">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  autoComplete="off"
                  placeholder="Buscar"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            )}
          </SheetHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
            {visible.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Ningún gasto fijo coincide.</p>
            )}
            <TemplateSection
              title="Pendientes este mes"
              items={pending}
              selectedId={selectedId}
              currency={currency}
              onChoose={choose}
            />
            <TemplateSection
              title="Ya registrados este mes"
              items={registered}
              selectedId={selectedId}
              currency={currency}
              onChoose={choose}
            />
            <Link
              href="/movimientos/fijos"
              className="self-center py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Administrar gastos fijos
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TemplateSection({
  title,
  items,
  selectedId,
  currency,
  onChoose,
}: {
  title: string;
  items: TemplateOption[];
  selectedId: string;
  currency: string;
  onChoose: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="divide-y overflow-hidden rounded-xl border">
        {items.map((t) => {
          const registeredDate = t.registeredOn ? parseDateInput(t.registeredOn) : null;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChoose(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  t.id === selectedId && "bg-primary/5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {registeredDate
                      ? `Registrado el ${formatDate(registeredDate)}`
                      : [t.categoryName, t.accountName].filter(Boolean).join(" · ") || "Sin categoría"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap tabular-nums",
                    t.type === "EXPENSE" ? "text-expense" : "text-income",
                  )}
                >
                  {t.type === "EXPENSE" ? "−" : "+"}
                  {formatCents(BigInt(t.amountCents), currency)}
                </span>
                {registeredDate ? (
                  <CheckIcon className="size-4 shrink-0 text-income" aria-label="Ya registrado" />
                ) : (
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
