import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/context";
import { toDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/form-options";
import { centsToInput } from "@/lib/money";
import { getAllBranches } from "@/lib/prices";
import { fullName, profileNameSelect } from "@/lib/profile-name";
import { toReceiptViews } from "@/lib/receipts";

import { TransactionForm } from "../../transaction-form";
import { TransactionReceipts } from "../../transaction-receipts";

export const metadata = { title: "Editar movimiento" };

export default async function EditTransactionPage({
  params,
}: PageProps<"/movimientos/[id]/editar">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  // Solo movimientos del espacio activo.
  const transaction = await db.transaction.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      createdBy: { select: profileNameSelect },
      template: { select: { name: true, amountCents: true } },
      // Su comisión/IVA (si los tiene) y, si él mismo es una comisión/IVA, de qué movimiento.
      charges: { select: { chargeType: true, amountCents: true } },
      parent: { select: { id: true, merchant: true } },
      receipts: {
        select: {
          id: true,
          storagePath: true,
          mimeType: true,
          status: true,
          _count: { select: { priceEntries: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!transaction) notFound();

  const [{ accounts, categories }, receipts, branchSuggestions] = await Promise.all([
    getFormOptions(workspace.id),
    toReceiptViews(transaction.receipts),
    getAllBranches(workspace.id),
  ]);
  const author = fullName(transaction.createdBy);
  const chargeInput = (kind: "COMMISSION" | "TAX") => {
    const charge = transaction.charges.find((c) => c.chargeType === kind);
    return charge ? centsToInput(charge.amountCents) : "";
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar movimiento</h1>
        <p className="text-sm text-muted-foreground">
          {[
            workspace.kind === "SHARED" ? `Registrado por ${author}` : `En ${workspace.name}`,
            transaction.template ? `Gasto fijo: ${transaction.template.name}` : null,
            transaction.parent
              ? `${transaction.chargeType === "TAX" ? "IVA" : "Comisión"} de «${transaction.parent.merchant ?? "otro movimiento"}»`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <TransactionForm
        accounts={accounts}
        categories={categories}
        currency={transaction.currency}
        branchSuggestions={branchSuggestions}
        cancelHref={`/movimientos/${transaction.id}`}
        transaction={{
          id: transaction.id,
          type: transaction.type,
          amount: centsToInput(transaction.amountCents),
          date: toDateInput(transaction.date),
          accountId: transaction.accountId,
          toAccountId: transaction.toAccountId,
          categoryId: transaction.categoryId,
          merchant: transaction.merchant,
          branch: transaction.branch,
          commission: chargeInput("COMMISSION"),
          tax: chargeInput("TAX"),
          chargeOf: transaction.parent ? (transaction.parent.merchant ?? "otro movimiento") : null,
          notes: transaction.notes,
          templateId: transaction.templateId,
          usual: transaction.template
            ? {
                name: transaction.template.name,
                // El habitual de cuando se registró; si no se guardó, el actual.
                amountCents: (transaction.templateAmountCents ?? transaction.template.amountCents).toString(),
              }
            : null,
        }}
      />
      <TransactionReceipts transactionId={transaction.id} receipts={receipts} />
    </div>
  );
}
