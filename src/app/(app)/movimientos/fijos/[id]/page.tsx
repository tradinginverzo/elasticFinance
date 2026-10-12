import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBadge } from "@/components/category-badge";
import { DetailHeader, DetailList } from "@/components/detail";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/context";
import { currentMonth, formatDate, formatMonth } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { getTemplatesWithStatus } from "@/lib/templates";

export const metadata = { title: "Gasto fijo" };

// Ficha de solo lectura de un gasto (o ingreso) fijo, con cómo va este mes. Para cambiarlo: "Editar".
export default async function TemplatePage({ params }: PageProps<"/movimientos/fijos/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  // Solo gastos fijos del espacio activo.
  const t = (await getTemplatesWithStatus(workspace.id)).find((x) => x.id === id);
  if (!t) notFound();
  const currency = workspace.currency;
  const isExpense = t.type === "EXPENSE";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <DetailHeader
        backHref="/movimientos/fijos"
        backLabel="Gastos fijos"
        title={t.name}
        subtitle={isExpense ? "Gasto fijo" : "Ingreso fijo"}
        editHref={`/movimientos/fijos/${t.id}/editar`}
      >
        <p className="mt-3 text-sm text-muted-foreground">Monto habitual</p>
        <p className={`text-3xl font-semibold tracking-tight tabular-nums ${isExpense ? "text-expense" : "text-income"}`}>
          {formatCents(t.amountCents, currency)}
        </p>
      </DetailHeader>

      {/* Cómo va este mes. */}
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          {t.isPaid ? (
            <CheckCircle2Icon className="size-5 text-income" />
          ) : (
            <CircleDashedIcon className="size-5 text-muted-foreground" />
          )}
          <p className="font-medium first-letter:uppercase">
            {formatMonth(currentMonth())}:{" "}
            {t.isPaid
              ? isExpense
                ? "pagado"
                : "recibido"
              : t.isPartial
                ? `pagado ${formatCents(t.paidCents, currency)} de ${formatCents(t.amountCents, currency)}`
                : isExpense
                  ? "por pagar"
                  : "por recibir"}
          </p>
        </div>
        {t.thisMonth.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {t.thisMonth.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/movimientos/${p.id}`}
                  className="flex justify-between gap-3 rounded-lg px-2 py-1 hover:bg-muted"
                >
                  <span className="text-muted-foreground">{formatDate(p.date, { day: "numeric", month: "long" })}</span>
                  <span className="font-medium tabular-nums">{formatCents(p.amountCents, currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!t.isPaid && (
          <Button className="h-10" render={<Link href={`/movimientos/nuevo?fijo=${t.id}`} />} nativeButton={false}>
            {t.isPartial ? `Pagar resto (${formatCents(t.remainingCents, currency)})` : "Registrar"}
          </Button>
        )}
      </section>

      <DetailList
        rows={[
          { label: "Tipo", value: isExpense ? "Gasto" : "Ingreso" },
          {
            label: "Categoría",
            value: (
              <span className="inline-flex items-center gap-2">
                <CategoryBadge name={t.category?.name ?? null} color={t.category?.color ?? null} />
                {t.category?.name ?? "Sin categoría"}
              </span>
            ),
          },
          { label: "Cuenta", value: t.account?.name ?? "Sin cuenta fija" },
          { label: "Comercio o descripción", value: t.merchant },
          { label: "Pagos parciales", value: t.allowPartial ? "Sí" : "No" },
        ]}
      />
    </div>
  );
}
