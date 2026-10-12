import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatAmount } from "@/lib/money";
import { formatPercent } from "@/lib/price-compare";
import { getBranches, getProductReferences, getStores } from "@/lib/prices";
import { formatPack, formatUnitPrice, PRODUCT_UNITS } from "@/lib/units";

import { AddPriceForm } from "./add-price-form";
import { PriceHistory } from "./price-history";

export const metadata = { title: "Producto" };

export default async function ProductPage({ params }: PageProps<"/precios/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const product = await db.product.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!product) notFound();

  const [references, stores, branches, history] = await Promise.all([
    getProductReferences(workspace.id, [product.id]),
    getStores(workspace.id),
    getBranches(workspace.id),
    db.priceEntry.findMany({
      where: { productId: product.id },
      include: { store: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 60,
    }),
  ]);
  const reference = references.get(product.id)!;
  const currency = workspace.currency;
  const unitPrice = (cents: number) => formatUnitPrice(cents, product.unit, currency);

  // Supermercados del más barato al más caro (por su último precio normal).
  const ranked = [...reference.stores].sort(
    (a, b) => (a.regular?.unitCents ?? Infinity) - (b.regular?.unitCents ?? Infinity),
  );
  const best = ranked[0]?.regular ?? null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <DetailHeader
        backHref="/precios"
        backLabel="Precios"
        title={product.name}
        subtitle={`${PRODUCT_UNITS.find((u) => u.value === product.unit)?.label} · precios por ${
          product.unit === "ML" ? "litro" : product.unit === "G" ? "kilo" : "unidad"
        }`}
        editHref={`/precios/${product.id}/editar`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Comparativa</CardTitle>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay precios. Anota el primero abajo.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {ranked.map((s, i) => {
                const r = s.regular;
                const diff = r && best && i > 0 ? r.unitCents / best.unitCents - 1 : null;
                return (
                  <li key={s.storeId} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium">
                          {s.storeName}
                          {i === 0 && r && (
                            <span className="rounded-full bg-income/15 px-2 py-0.5 text-[11px] font-semibold text-income">
                              Mejor precio
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r
                            ? `${[r.brand, formatPack(r.sizeEach, r.packCount, product.unit)].filter(Boolean).join(" · ")} a ${formatAmount(r.priceCents, currency)} · ${formatDate(new Date(`${r.date}T00:00:00Z`))}${r.branch ? ` · ${r.branch}` : ""}`
                            : "Sin precio normal (solo oferta)"}
                        </p>
                      </div>
                      {r && (
                        <div className="text-right">
                          <p className="text-sm font-semibold whitespace-nowrap tabular-nums">{unitPrice(r.unitCents)}</p>
                          {diff !== null && diff > 0.001 && (
                            <p className="text-xs text-expense tabular-nums">+{formatPercent(diff)}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {s.offer && (
                      <p className="text-xs font-medium text-income">
                        Oferta el {formatDate(new Date(`${s.offer.date}T00:00:00Z`))}:{" "}
                        {[s.offer.brand, formatPack(s.offer.sizeEach, s.offer.packCount, product.unit)]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        a {formatAmount(s.offer.priceCents, currency)} ({unitPrice(s.offer.unitCents)})
                        {s.offer.branch ? ` · ${s.offer.branch}` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium">
          + Anotar precio
          <span className="text-xs text-muted-foreground group-open:hidden">Tocar para abrir</span>
        </summary>
        <div className="border-t px-4 py-4">
          <AddPriceForm
            productId={product.id}
            unit={product.unit}
            currency={currency}
            stores={stores}
            branches={branches}
            reference={reference}
          />
        </div>
      </details>

      <PriceHistory history={history} unit={product.unit} currency={currency} />
    </div>
  );
}
