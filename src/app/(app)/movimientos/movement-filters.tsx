"use client";

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import {
  ACCOUNT_TYPES,
  countPanelFilters,
  EMPTY_FILTERS,
  type Filters,
  filtersToParams,
  MOVEMENT_TYPES,
  SORTS,
} from "./filters";

type Option = { id: string; name: string };
type CategoryOption = Option & { type: "EXPENSE" | "INCOME" };

// Buscador + panel de filtros + etiquetas de los filtros activos del listado de movimientos.
export function MovementFilters({
  filters,
  month,
  accounts,
  categories,
}: {
  filters: Filters;
  month: string;
  accounts: Option[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function apply(next: Filters) {
    const query = filtersToParams(next, month).toString();
    startTransition(() => router.replace(`/movimientos${query ? `?${query}` : ""}`, { scroll: false }));
  }

  // Buscador: se aplica solo, un momento después de dejar de escribir.
  const [q, setQ] = useState(filters.q);
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });
  useEffect(() => {
    if (q.trim() === latest.current.q) return;
    const timer = setTimeout(() => apply({ ...latest.current, q: q.trim() }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al escribir
  }, [q]);

  const panelCount = countPanelFilters(filters);
  const chips = activeChips(filters, accounts);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar comercio, nota, categoría…"
            autoComplete="off"
            className="h-10 pl-8"
            maxLength={100}
          />
        </div>
        <Button
          variant={panelCount > 0 ? "default" : "outline"}
          className="h-10"
          onClick={() => setOpen(true)}
          aria-label="Filtros y orden"
        >
          <SlidersHorizontalIcon />
          <span className="hidden sm:inline">Filtros</span>
          {panelCount > 0 && <span className="tabular-nums">({panelCount})</span>}
        </Button>
      </div>

      {chips.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-1.5", pending && "opacity-60")}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => apply({ ...filters, ...chip.clear })}
              className="flex items-center gap-1 rounded-full border bg-muted/60 py-1 pr-1.5 pl-2.5 text-xs hover:bg-muted"
              aria-label={`Quitar filtro: ${chip.label}`}
            >
              {chip.label}
              <XIcon className="size-3.5 text-muted-foreground" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setQ("");
              apply(EMPTY_FILTERS);
            }}
            className="px-1 text-xs font-medium text-primary hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filtros y orden</SheetTitle>
          </SheetHeader>
          {open && (
            <FilterPanel
              initial={{ ...filters, q: q.trim() }}
              accounts={accounts}
              categories={categories}
              onApply={(next) => {
                apply(next);
                setOpen(false);
              }}
              onClear={() => {
                setQ("");
                apply(EMPTY_FILTERS);
                setOpen(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterPanel({
  initial,
  accounts,
  categories,
  onApply,
  onClear,
}: {
  initial: Filters;
  accounts: Option[];
  categories: CategoryOption[];
  onApply: (filters: Filters) => void;
  onClear: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setF((prev) => ({ ...prev, [key]: value }));
  // Las transferencias no tienen categoría; con un tipo elegido, solo sus categorías.
  // Por nombre: "Trading" reúne la de gasto y la de ingreso.
  const visibleCategories = [
    ...new Set(categories.filter((c) => !f.tipo || f.tipo === c.type).map((c) => c.name)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-5 px-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(f);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label>Tipo de movimiento</Label>
        <Segmented
          label="Tipo de movimiento"
          value={f.tipo ?? "ALL"}
          onChange={(v) => {
            const tipo = v === "ALL" ? null : v;
            setF((prev) => ({
              ...prev,
              tipo,
              // La categoría elegida deja de valer si no es de ese tipo.
              cat: tipo && !categories.some((c) => c.name === prev.cat && c.type === tipo) ? null : prev.cat,
            }));
          }}
          options={[
            { value: "ALL", label: "Todos" },
            // "Transf." para que quepa en el iPhone.
            ...MOVEMENT_TYPES.map((t) => ({ value: t.value, label: t.value === "TRANSFER" ? "Transf." : t.label })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="f-sort">Ordenar por</Label>
        <NativeSelect id="f-sort" value={f.orden} onChange={(e) => set("orden", e.target.value as Filters["orden"])}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Fechas</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            aria-label="Desde"
            className="h-10"
            value={f.desde}
            max={f.hasta || undefined}
            onChange={(e) => set("desde", e.target.value)}
          />
          <Input
            type="date"
            aria-label="Hasta"
            className="h-10"
            value={f.hasta}
            min={f.desde || undefined}
            onChange={(e) => set("hasta", e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">Vacío: se muestra el mes que elijas en el listado.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="f-account">Cuenta</Label>
        <NativeSelect id="f-account" value={f.cuenta ?? ""} onChange={(e) => set("cuenta", e.target.value || null)}>
          <option value="">Todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="f-account-type">Tipo de cuenta</Label>
        <NativeSelect
          id="f-account-type"
          value={f.tipoCuenta ?? ""}
          onChange={(e) => set("tipoCuenta", (e.target.value || null) as Filters["tipoCuenta"])}
        >
          <option value="">Todos</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {f.tipo !== "TRANSFER" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-category">Categoría</Label>
          <NativeSelect id="f-category" value={f.cat ?? ""} onChange={(e) => set("cat", e.target.value || null)}>
            <option value="">Todas</option>
            {visibleCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Monto</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Monto mínimo"
            inputMode="decimal"
            placeholder="Mínimo"
            className="h-10 tabular-nums"
            value={f.min}
            onChange={(e) => set("min", e.target.value)}
          />
          <Input
            aria-label="Monto máximo"
            inputMode="decimal"
            placeholder="Máximo"
            className="h-10 tabular-nums"
            value={f.max}
            onChange={(e) => set("max", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" className="h-10">
          Ver resultados
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={onClear}>
          Limpiar filtros
        </Button>
      </div>
    </form>
  );
}

// Etiquetas de los filtros activos; cada una sabe qué limpiar.
function activeChips(f: Filters, accounts: Option[]) {
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];
  const day = (d: string) => formatDate(new Date(`${d}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric" });
  if (f.q) chips.push({ key: "q", label: `«${f.q}»`, clear: { q: "" } });
  if (f.tipo) chips.push({ key: "tipo", label: MOVEMENT_TYPES.find((t) => t.value === f.tipo)!.label, clear: { tipo: null } });
  if (f.cuenta) {
    chips.push({ key: "cuenta", label: accounts.find((a) => a.id === f.cuenta)?.name ?? "Cuenta", clear: { cuenta: null } });
  }
  if (f.tipoCuenta) {
    chips.push({
      key: "tipoCuenta",
      label: ACCOUNT_TYPES.find((t) => t.value === f.tipoCuenta)!.label,
      clear: { tipoCuenta: null },
    });
  }
  if (f.cat) chips.push({ key: "cat", label: f.cat, clear: { cat: null } });
  if (f.min || f.max) {
    const label = f.min && f.max ? `$${f.min} a $${f.max}` : f.min ? `Desde $${f.min}` : `Hasta $${f.max}`;
    chips.push({ key: "monto", label, clear: { min: "", max: "" } });
  }
  if (f.desde || f.hasta) {
    const label =
      f.desde && f.hasta ? `${day(f.desde)} – ${day(f.hasta)}` : f.desde ? `Desde ${day(f.desde)}` : `Hasta ${day(f.hasta)}`;
    chips.push({ key: "fechas", label, clear: { desde: "", hasta: "" } });
  }
  if (f.orden !== "fecha_desc") {
    chips.push({ key: "orden", label: SORTS.find((s) => s.value === f.orden)!.label, clear: { orden: "fecha_desc" } });
  }
  return chips;
}
