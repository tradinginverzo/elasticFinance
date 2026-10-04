import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { getFormOptions } from "@/lib/form-options";
import { getTemplateOptions } from "@/lib/templates";

import { TransactionForm } from "../transaction-form";

export const metadata = { title: "Nuevo movimiento" };

export default async function NewTransactionPage({
  searchParams,
}: PageProps<"/movimientos/nuevo">) {
  const { workspace } = await requireWorkspace();
  const { fijo } = await searchParams;
  const [{ accounts, categories }, templates] = await Promise.all([
    getFormOptions(workspace.id),
    getTemplateOptions(workspace.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
        <p className="text-sm text-muted-foreground">En {workspace.name}</p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-medium">Primero crea una cuenta</p>
            <p className="text-sm text-muted-foreground">
              Cada movimiento sale de una cuenta: efectivo, banco o tarjeta.
            </p>
            <Button render={<Link href="/cuentas/nueva" />} nativeButton={false}>
              Crear cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          currency={workspace.currency}
          templates={templates}
          // Desde "Gastos fijos → Registrar" llega ?fijo=<id> para rellenar el formulario.
          initialTemplateId={typeof fijo === "string" ? fijo : null}
        />
      )}
    </div>
  );
}
