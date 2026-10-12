import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBadge } from "@/components/category-badge";
import { DetailHeader, DetailList } from "@/components/detail";
import { ReceiptThumb } from "@/components/receipt-thumb";
import { requireWorkspace } from "@/lib/context";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { fullName, profileNameSelect } from "@/lib/profile-name";
import { toReceiptViews } from "@/lib/receipts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Movimiento" };

const TYPE_LABEL = { EXPENSE: "Gasto", INCOME: "Ingreso", TRANSFER: "Transferencia" } as const;
const CHARGE_LABEL = { COMMISSION: "Comisión", TAX: "IVA" } as const;

// Ficha de solo lectura de un movimiento. Para cambiarlo: botón "Editar".
export default async function TransactionPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const t = await db.transaction.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      category: { select: { name: true, color: true } },
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
      createdBy: { select: profileNameSelect },
      template: { select: { id: true, name: true } },
      receipts: {
        select: { id: true, storagePath: true, mimeType: true, status: true },
        orderBy: { createdAt: "asc" },
      },
      charges: { select: { id: true, chargeType: true, amountCents: true }, orderBy: { chargeType: "asc" } },
      parent: { select: { id: true, merchant: true, type: true } },
    },
  });
  if (!t) notFound();
  const receipts = await toReceiptViews(t.receipts);

  const isTransfer = t.type === "TRANSFER";
  const title = t.merchant || t.category?.name || TYPE_LABEL[t.type];
  const month = t.date.toISOString().slice(0, 7);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <DetailHeader
        backHref={`/movimientos?mes=${month}`}
        backLabel="Movimientos"
        title={title}
        subtitle={formatDate(t.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        editHref={`/movimientos/${t.id}/editar`}
      >
        <p
          className={cn(
            "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
            t.type === "EXPENSE" && "text-expense",
            t.type === "INCOME" && "text-income",
          )}
        >
          {t.type === "EXPENSE" ? "−" : t.type === "INCOME" ? "+" : ""}
          {formatCents(t.amountCents, t.currency)}
        </p>
      </DetailHeader>

      <DetailList
        rows={[
          { label: "Tipo", value: TYPE_LABEL[t.type] },
          ...(isTransfer
            ? [
                { label: "Desde", value: t.account.name },
                { label: "Hacia", value: t.toAccount?.name ?? "—" },
              ]
            : [{ label: "Cuenta", value: t.account.name }]),
          {
            label: "Categoría",
            value: !isTransfer && (
              <span className="inline-flex items-center gap-2">
                <CategoryBadge name={t.category?.name ?? null} color={t.category?.color ?? null} />
                {t.category?.name ?? "Sin categoría"}
              </span>
            ),
          },
          { label: t.type === "EXPENSE" ? "Comercio" : "Descripción", value: t.merchant },
          { label: "Sucursal", value: t.branch },
          {
            label: "Gasto fijo",
            value: t.template && (
              <Link href={`/movimientos/fijos/${t.template.id}`} className="text-primary underline-offset-4 hover:underline">
                {t.template.name}
              </Link>
            ),
          },
          {
            label: t.chargeType ? `${CHARGE_LABEL[t.chargeType]} de` : "",
            value: t.parent && (
              <Link href={`/movimientos/${t.parent.id}`} className="text-primary underline-offset-4 hover:underline">
                {t.parent.merchant || TYPE_LABEL[t.parent.type]}
              </Link>
            ),
          },
          ...t.charges.map((c) => ({
            label: c.chargeType ? CHARGE_LABEL[c.chargeType] : "Cargo",
            value: (
              <Link href={`/movimientos/${c.id}`} className="text-expense underline-offset-4 hover:underline">
                −{formatCents(c.amountCents, t.currency)}
              </Link>
            ),
          })),
          { label: "Notas", value: t.notes, className: "whitespace-pre-line text-left font-normal" },
          { label: "Registrado por", value: workspace.kind === "SHARED" ? fullName(t.createdBy) : null },
        ]}
      />

      {receipts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium">Facturas</h2>
          <ul className="flex flex-wrap gap-3">
            {receipts.map((r) => (
              <li key={r.id}>
                <ReceiptThumb url={r.url} isPdf={r.mimeType === "application/pdf"} className="size-20" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
