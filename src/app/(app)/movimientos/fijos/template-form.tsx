"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";

import { deleteTemplate, saveTemplate, type TemplateFormState } from "./actions";

type TransactionType = "EXPENSE" | "INCOME";

const initialState: TemplateFormState = { error: null };

export function TemplateForm({
  template,
  accounts,
  categories,
  currency,
}: {
  template?: {
    id: string;
    name: string;
    type: TransactionType;
    amount: string;
    accountId: string | null;
    categoryId: string | null;
    merchant: string | null;
  };
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: TransactionType }[];
  currency: string;
}) {
  const { state, onSubmit, pending } = useFormAction(
    saveTemplate.bind(null, template?.id ?? null),
    initialState,
  );
  const [type, setType] = useState<TransactionType>(template?.type ?? "EXPENSE");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    if (!template || !confirm(`¿Eliminar "${template.name}"? Los movimientos ya registrados se conservan.`)) return;
    startDelete(async () => {
      const result = await deleteTemplate(template.id);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
        <input type="hidden" name="type" value={type} />
        <Segmented
          label="Tipo"
          value={type}
          onChange={setType}
          options={[
            { value: "EXPENSE", label: "Gasto fijo" },
            { value: "INCOME", label: "Ingreso fijo" },
          ]}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            name="name"
            autoComplete="off"
            className="h-10"
            placeholder={type === "EXPENSE" ? "Alquiler, luz, internet…" : "Sueldo…"}
            defaultValue={template?.name}
            maxLength={60}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Monto habitual ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            className="h-10 tabular-nums"
            defaultValue={template?.amount}
            required
          />
          <p className="text-xs text-muted-foreground">
            Al registrarlo cada mes podrás cambiarlo si fue distinto.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="accountId">Cuenta</Label>
            <NativeSelect
              id="accountId"
              name="accountId"
              defaultValue={template?.accountId ?? accounts[0]?.id ?? ""}
            >
              <option value="">Elegir al registrar</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">Categoría</Label>
            <NativeSelect
              key={type}
              id="categoryId"
              name="categoryId"
              defaultValue={template?.type === type ? (template.categoryId ?? "") : ""}
            >
              <option value="">Sin categoría</option>
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </NativeSelect>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="merchant">Comercio o descripción</Label>
          <Input
            id="merchant"
            name="merchant"
            autoComplete="off"
            className="h-10"
            placeholder="Opcional: Edenorte, Claro…"
            defaultValue={template?.merchant ?? ""}
            maxLength={100}
          />
        </div>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
            {pending ? "Guardando…" : template ? "Guardar cambios" : "Guardar"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10"
            render={<Link href="/movimientos/fijos" />}
            nativeButton={false}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {template && (
        <div className="flex flex-col gap-2 border-t pt-6">
          <Button variant="destructive" className="h-10" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Eliminando…" : "Eliminar gasto fijo"}
          </Button>
          <FormError message={deleteError} />
        </div>
      )}
    </div>
  );
}
