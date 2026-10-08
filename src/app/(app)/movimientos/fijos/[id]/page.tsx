import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/form-options";
import { centsToInput } from "@/lib/money";
import { isFlowType } from "@/lib/transaction-types";

import { TemplateForm } from "../template-form";

export const metadata = { title: "Editar gasto fijo" };

export default async function EditTemplatePage({
  params,
}: PageProps<"/movimientos/fijos/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  // Solo gastos fijos del espacio activo.
  const template = await db.transactionTemplate.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!template || !isFlowType(template.type)) notFound();
  const { accounts, categories } = await getFormOptions(workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
        <p className="text-sm text-muted-foreground">En {workspace.name}</p>
      </div>
      <TemplateForm
        accounts={accounts}
        categories={categories}
        currency={workspace.currency}
        template={{
          id: template.id,
          name: template.name,
          type: template.type,
          amount: centsToInput(template.amountCents),
          accountId: template.accountId,
          categoryId: template.categoryId,
          merchant: template.merchant,
        }}
      />
    </div>
  );
}
