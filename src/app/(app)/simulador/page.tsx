import { getBaseline } from "@/lib/baseline";
import { requireWorkspace } from "@/lib/context";

import { Simulator } from "./simulator";

export const metadata = { title: "Simulador" };

export default async function SimulatorPage() {
  const { workspace } = await requireWorkspace();
  const baseline = await getBaseline(workspace.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
        <p className="text-sm text-muted-foreground">
          Mira cómo cambiaría tu saldo con una compra (al contado o a crédito), un ingreso, o al
          añadir o cancelar un gasto fijo.
        </p>
      </div>
      <Simulator baseline={baseline} currency={workspace.currency} workspaceName={workspace.name} />
    </div>
  );
}
