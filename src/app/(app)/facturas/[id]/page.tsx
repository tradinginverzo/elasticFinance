import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptThumb } from "@/components/receipt-thumb";
import { requireWorkspace } from "@/lib/context";
import { todayInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { emptyDraft } from "@/lib/price-draft";
import { aliasText, getBranches, getStores } from "@/lib/prices";
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
    include: {
      _count: { select: { priceEntries: true } },
      transaction: { select: { branch: true } },
    },
  });
  if (!receipt) notFound();

  const extracted = (receipt.extractedData ?? null) as Extracted | null;
  const items = extracted?.items ?? [];
  const [[view], stores, branches, products, aliases] = await Promise.all([
    toReceiptViews([receipt]),
    getStores(workspace.id),
    getBranches(workspace.id),
    db.product.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    db.productAlias.findMany({
      where: { workspaceId: workspace.id, text: { in: items.map((i) => aliasText(i.text)) } },
      select: { text: true, productId: true, brand: true, sizeEach: true, packCount: true },
    }),
  ]);

  // Sugerencias: primero lo que ya confirmaste antes para esa línea; luego el nombre de la IA.
  const aliasMap = new Map(aliases.map((a) => [a.text, a]));
  const byName = new Map(products.map((p) => [p.name.toLocaleLowerCase("es"), p]));
  const reviewItems: ReviewItem[] = items.map((item, i) => {
    const alias = aliasMap.get(aliasText(item.text));
    const product =
      products.find((p) => p.id === alias?.productId) ?? byName.get(item.product.trim().toLocaleLowerCase("es"));
    const unit = product?.unit ?? item.unit;
    const quantity = item.quantity > 0 ? item.quantity : 1;

    // Precio de góndola: si la línea viene sin IVA y el producto lo paga, se le suma
    // (para compararlo con el precio que se ve en el súper, que ya lo incluye).
    const taxFactor =
      extracted?.line_prices_include_tax === false && item.taxed ? 1 + (extracted.tax_rate ?? 15) / 100 : 1;
    const paid = Math.round(((item.line_total * taxFactor) / quantity) * 100);

    // Precio normal: desde el % de la oferta (resumen por categoría) o desde el descuento de la línea.
    // El precio de la línea ya trae el descuento aplicado.
    const percent = item.discount_percent ?? null;
    const regular =
      percent && percent > 0 && percent < 100
        ? Math.round(paid / (1 - percent / 100))
        : item.discount && item.discount > 0
          ? Math.round(paid + ((item.discount * taxFactor) / quantity) * 100)
          : null;

    // Medida: la impresa en la factura o, si no viene (Supermaxi), la que confirmaste la vez anterior.
    const fromAlias = alias?.productId === product?.id ? alias : undefined;
    const pack = item.pack_count > 0 ? item.pack_count : (fromAlias?.packCount ?? 1);
    const printedSize = item.size_each && item.size_each > 0 ? item.size_each : null;
    const baseSize = printedSize ?? fromAlias?.sizeEach ?? null;
    // En unidades no hay "× paquete": 4 rollos = 4 unidades.
    const sizeEach = unit === "UNIT" && baseSize !== null ? baseSize * (printedSize ? pack : 1) : baseSize;
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
        brand: item.brand ?? fromAlias?.brand ?? "",
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

      {!receipt.transactionId && desde !== "movimiento" && (
        <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
          Esta factura no está registrada como gasto. Guardar los precios no crea ningún movimiento.{" "}
          <Link
            href={`/movimientos/nuevo?factura=${receipt.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Registrar como movimiento
          </Link>
        </p>
      )}

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
          initialBranch={receipt.transaction?.branch ?? extracted?.branch ?? ""}
          branches={branches}
          currency={workspace.currency}
          saved={receipt.itemsSavedAt !== null}
        />
      )}
    </div>
  );
}
