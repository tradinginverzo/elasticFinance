"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import { activateWorkspace } from "../../../espacios/actions";
import { copyTemplates, type CopyTemplatesState } from "../actions";

type Item = {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  amountCents: string;
  categoryName: string | null;
  categoryColor: string | null;
};

const initialState: CopyTemplatesState = { error: null };

export function CopyTemplatesForm({
  templates,
  targets,
  sourceName,
  currency,
}: {
  templates: Item[];
  targets: { id: string; name: string }[];
  sourceName: string;
  currency: string;
}) {
  const { state, onSubmit, pending } = useFormAction(copyTemplates, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set(templates.map((t) => t.id)));
  const [switching, startSwitch] = useTransition();
  const allSelected = selected.size === templates.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (state.result) {
    const { copied, skipped, removed, targetId, targetName } = state.result;
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
        <CheckCircle2Icon className="size-10 text-income" />
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-base font-medium">
            {copied} {copied === 1 ? "copiado" : "copiados"} a {targetName}
          </p>
          {skipped > 0 && (
            <p className="text-muted-foreground">
              {skipped} ya {skipped === 1 ? "existía" : "existían"} allí y no se {skipped === 1 ? "duplicó" : "duplicaron"}.
            </p>
          )}
          {removed > 0 && (
            <p className="text-muted-foreground">
              {removed} {removed === 1 ? "quitado" : "quitados"} de {sourceName}. Sus movimientos ya registrados se conservan.
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button disabled={switching} onClick={() => startSwitch(() => activateWorkspace(targetId))}>
            {switching ? "Cambiando…" : `Ir a ${targetName}`}
          </Button>
          <Button variant="outline" render={<Link href="/movimientos/fijos" />} nativeButton={false}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="targetId">Copiar a</Label>
        <NativeSelect id="targetId" name="targetId" defaultValue={targets[0]?.id}>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>
            Gastos fijos ({selected.size} de {templates.length})
          </Label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(allSelected ? new Set() : new Set(templates.map((t) => t.id)))}
          >
            {allSelected ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>
        <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-xl border">
          {templates.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                <input
                  type="checkbox"
                  name="templateIds"
                  value={t.id}
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="size-4 accent-primary"
                />
                <CategoryBadge name={t.categoryName} color={t.categoryColor} />
                <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    t.type === "EXPENSE" ? "text-expense" : "text-income",
                  )}
                >
                  {t.type === "EXPENSE" ? "−" : "+"}
                  {formatCents(BigInt(t.amountCents), currency)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
        <input type="checkbox" name="removeOriginals" className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Quitarlos de {sourceName} después de copiar</span>
          <span className="block text-xs text-muted-foreground">
            Es como moverlos. Los movimientos que ya registraste con ellos se quedan en {sourceName}.
          </span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground">
        La categoría y la cuenta se buscan por nombre en el espacio de destino. Si la cuenta no
        existe allí, el gasto fijo queda con «Elegir al registrar». Los que ya existan con el mismo
        nombre no se duplican.
      </p>

      <FormError message={state.error} />

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending || selected.size === 0}>
          {pending ? "Copiando…" : `Copiar ${selected.size}`}
        </Button>
        <Button variant="outline" size="lg" className="h-10" render={<Link href="/movimientos/fijos" />} nativeButton={false}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
