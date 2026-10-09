import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";

import { StoreList } from "./store-list";

export const metadata = { title: "Supermercados" };

export default async function StoresPage() {
  const { workspace } = await requireWorkspace();
  const stores = await db.store.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { priceEntries: true } } },
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Supermercados</h1>
        <p className="text-sm text-muted-foreground">
          Se agregan solos al anotar un precio, al elegir dónde compras o al leer una factura.
        </p>
      </div>
      <StoreList stores={stores.map((s) => ({ id: s.id, name: s.name, prices: s._count.priceEntries }))} />
    </div>
  );
}
