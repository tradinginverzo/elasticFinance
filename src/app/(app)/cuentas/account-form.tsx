"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormError } from "@/components/form-error";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";

import { deleteAccount, saveAccount, type AccountFormState } from "./actions";

type AccountType = "CASH" | "BANK" | "CREDIT_CARD" | "SAVINGS";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "BANK", label: "Cuenta bancaria" },
  { value: "CREDIT_CARD", label: "Tarjeta de crédito" },
  { value: "SAVINGS", label: "Ahorro" },
];

const initialState: AccountFormState = { error: null };

export function AccountForm({
  account,
  currency,
}: {
  account?: {
    id: string;
    name: string;
    type: AccountType;
    initialBalance: string;
    transactionCount: number;
  };
  currency: string;
}) {
  const { state, onSubmit, pending } = useFormAction(
    saveAccount.bind(null, account?.id ?? null),
    initialState,
  );
  const [type, setType] = useState<AccountType>(account?.type ?? "BANK");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    if (!account || !confirm(`¿Eliminar la cuenta "${account.name}"?`)) return;
    startDelete(async () => {
      const result = await deleteAccount(account.id);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            name="name"
            autoComplete="off"
            className="h-10"
            placeholder="Banco Principal, Billetera…"
            defaultValue={account?.name}
            maxLength={60}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="initialBalance">Saldo inicial ({currency})</Label>
          <Input
            id="initialBalance"
            name="initialBalance"
            autoComplete="off"
            className="h-10"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={account?.initialBalance}
          />
          <p className="text-xs text-muted-foreground">
            {type === "CREDIT_CARD"
              ? "Si debes dinero en la tarjeta, escríbelo en negativo (por ejemplo -350,00)."
              : "Cuánto dinero tenía la cuenta al empezar a usar la app."}
          </p>
        </div>

        <FormError message={state.error} />

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
            {pending ? "Guardando…" : account ? "Guardar cambios" : "Crear cuenta"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10"
            render={<Link href="/cuentas" />}
            nativeButton={false}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {account && (
        <div className="flex flex-col gap-2 border-t pt-6">
          <Button
            variant="destructive"
            className="h-10"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar cuenta"}
          </Button>
          {account.transactionCount > 0 && !deleteError && (
            <p className="text-xs text-muted-foreground">
              Solo se puede eliminar una cuenta sin movimientos.
            </p>
          )}
          <FormError message={deleteError} />
        </div>
      )}
    </div>
  );
}
