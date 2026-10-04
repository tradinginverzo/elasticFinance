import { requireWorkspace } from "@/lib/context";
import { getFormOptions } from "@/lib/form-options";

import { TemplateForm } from "../template-form";

export const metadata = { title: "Nuevo gasto fijo" };

export default async function NewTemplatePage() {
  const { workspace } = await requireWorkspace();
  const { accounts, categories } = await getFormOptions(workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo gasto fijo</h1>
        <p className="text-sm text-muted-foreground">En {workspace.name}</p>
      </div>
      <TemplateForm accounts={accounts} categories={categories} currency={workspace.currency} />
    </div>
  );
}
