import { notFound } from "next/navigation";

import { ReceiptThumb } from "@/components/receipt-thumb";
import { requireWorkspace } from "@/lib/context";
import { todayInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { emptyDraft } from "@/lib/price-draft";
import { aliasText, getStores } from "@/lib/prices";
import { type Extracted, receiptReadingEnabled, toReceiptViews } from "@/lib/receipts";
import { fromBaseSize } from "@/lib/units";

import { ReadItemsButton, ReceiptItemsForm, type ReviewItem } from "./receipt-items-form";

export const metadata = { title: "Productos de la factura" };

const centsText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default async function ReceiptItemsPage({ params, searchParams }: PageProps<"/facturas/[id]">) {
  const { id } = await params;
  const { desde } = await searchParams;
  const { workspace } = await requireWorkspace();
  const receipt = await db.receipt.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { _count: { select: { priceEntries: true } } },
  });
  if (!receipt) notFound();

  const extracted = (receipt.extractedData ?? null) as Extracted | null;
  const items = extracted?.items ?? [];
  const [[view], stores, products, aliases] = await Promise.all([
    toReceiptViews([receipt]),
    getStores(workspace.id),
    db.product.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    db.productAlias.findMany({
      where: { workspaceId: workspace.id, text: { in: items.map((i) => aliasText(i.text)) } },
      select: { text: true, productId: true },
    }),
  ]);

  // Sugerencias: primero lo que ya confirmaste antes para esa línea; luego el nombre de la IA.
  const aliasMap = new Map(aliases.map((a) => [a.text, a.productId]));
  const byName = new Map(products.map((p) => [p.name.toLocaleLowerCase("es"), p]));
  const reviewItems: ReviewItem[] = items.map((item, i) => {
    const product =
      products.find((p) => p.id === aliasMap.get(aliasText(item.text))) ??
      byName.get(item.product.trim().toLocaleLowerCase("es"));
    const unit = product?.unit ?? item.unit;
    const quantity = item.quantity > 0 ? item.quantity : 1;
    const paid = Math.round((item.line_total / quantity) * 100);
    const regular = item.discount && item.discount > 0 ? Math.round(((item.line_total + item.discount) / quantity) * 100) : null;
    const pack = item.pack_count > 0 ? item.pack_count : 1;
    // En unidades no hay "× paquete": 4 rollos = 4 unidades.
    const sizeEach = unit === "UNIT" ? (item.size_each || 1) * pack : item.size_each;
    const size = sizeEach && sizeEach > 0 ? fromBaseSize(sizeEach, unit) : null;
    return {
      key: String(i),
      text: item.text,
      include: size !== null && paid > 0,
      productId: product?.id ?? "",
      newName: product ? "" : item.product,
      unit,
      quantity: String(quantity).replace(".", ","),
      draft: {
        ...emptyDraft(unit),
        brand: item.brand ?? "",
        sizeValue: size?.value ?? "",
        sizeUnit: size?.unit ?? emptyDraft(unit).sizeUnit,
        packCount: unit === "UNIT" ? "1" : String(pack),
        price: paid > 0 ? centsText(paid) : "",
        onSale: regular !== null,
        regularPrice: regular !== null ? centsText(regular) : "",
      },
    };
  });

  const storeMatch = extracted?.merchant
    ? stores.find((s) => s.name.toLocaleLowerCase("es") === extracted.merchant!.toLocaleLowerCase("es"))
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {desde === "movimiento" && (
        <p className="rounded-xl bg-income/10 px-4 py-3 text-sm font-medium text-income">
          Movimiento guardado. Ahora guarda los precios de los productos para compararlos.
        </p>
      )}
      <div className="flex items-start gap-4">
        <ReceiptThumb url={view.url} isPdf={receipt.mimeType === "application/pdf"} className="size-20" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Productos de la factura</h1>
          <p className="text-sm text-muted-foreground">
            {receipt.itemsSavedAt
              ? `${receipt._count.priceEntries} precios guardados en el comparador. Puedes corregirlos y volver a guardar.`
              : "Revisa lo que leyó la IA y guárdalo en el comparador de precios."}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border p-4 text-sm">
          <p className="text-muted-foreground">
            {receiptReadingEnabled()
              ? "No hay productos leídos de esta factura (se subió antes del comparador o no es una compra con productos)."
              : "La lectura automática no está activada."}
          </p>
          {receiptReadingEnabled() && <ReadItemsButton receiptId={receipt.id} />}
        </div>
      ) : (
        <ReceiptItemsForm
          receiptId={receipt.id}
          items={reviewItems}
          products={products}
          stores={stores}
          initialStoreId={storeMatch?.id ?? (stores.length > 0 && !extracted?.merchant ? stores[0].id : "")}
          initialStoreName={storeMatch ? "" : (extracted?.merchant ?? "")}
          initialDate={extracted?.date ?? todayInput()}
          currency={workspace.currency}
          saved={receipt.itemsSavedAt !== null}
        />
      )}
    </div>
  );
}
