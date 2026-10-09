import { PlusIcon, StoreIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/context";
import { bestRegular } from "@/lib/price-compare";
import { getProductReferences } from "@/lib/prices";
import { formatPack, formatUnitPrice } from "@/lib/units";

import { ProductList, type ProductRow } from "./product-list";

export const metadata = { title: "Precios" };

export default async function PricesPage() {
  const { workspace } = await requireWorkspace();
  const references = await getProductReferences(workspace.id);

  const rows: ProductRow[] = [...references.values()].map((ref) => {
    const best = bestRegular(ref);
    // Oferta reciente más barata que el mejor precio normal.
    const offer = ref.stores
      .map((s) => s.offer)
      .filter((o) => o && (!best || o.unitCents < best.unitCents))
      .sort((a, b) => a!.unitCents - b!.unitCents)[0];
    // Sin precio normal en ningún lado: se muestra la oferta (marcada como tal).
    const shown = best ?? offer;
    return {
      id: ref.productId,
      name: ref.name,
      storeCount: ref.stores.length,
      best: shown
        ? {
            storeName: shown.storeName,
            detail: [shown.brand, formatPack(shown.sizeEach, shown.packCount, ref.unit), best ? null : "oferta"]
              .filter(Boolean)
              .join(" · "),
            unitPrice: formatUnitPrice(shown.unitCents, ref.unit, workspace.currency),
          }
        : null,
      offerStore: best ? (offer?.storeName ?? null) : null,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Precios</h1>
          <p className="text-sm text-muted-foreground">Dónde sale más barato cada producto</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Supermercados"
            render={<Link href="/precios/supermercados" />}
            nativeButton={false}
          >
            <StoreIcon />
          </Button>
          <Button render={<Link href="/precios/nuevo" />} nativeButton={false} className="h-9">
            <PlusIcon />
            Producto
          </Button>
        </div>
      </div>

      <ProductList products={rows} />
    </div>
  );
}
