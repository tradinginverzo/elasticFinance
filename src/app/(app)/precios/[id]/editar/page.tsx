import { notFound } from "next/navigation";

import { DetailHeader } from "@/components/detail";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";

import { PriceHistory } from "../price-history";
import { ProductSettings } from "../product-settings";

export const metadata = { title: "Editar producto" };

// Edición de un producto: cambiar el nombre, borrar precios mal anotados o eliminarlo.
export default async function EditProductPage({ params }: PageProps<"/precios/[id]/editar">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const product = await db.product.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!product) notFound();
  const history = await db.priceEntry.findMany({
    where: { productId: product.id },
    include: { store: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <DetailHeader
        backHref={`/precios/${product.id}`}
        backLabel="Volver al producto"
        title={`Editar: ${product.name}`}
        subtitle="Aquí puedes borrar precios anotados por error."
      />
      <ProductSettings productId={product.id} name={product.name} />
      <PriceHistory history={history} unit={product.unit} currency={workspace.currency} editable />
    </div>
  );
}
