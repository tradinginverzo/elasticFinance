import { requireWorkspace } from "@/lib/context";

import { NewProductForm } from "./new-product-form";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { workspace } = await requireWorkspace();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          En {workspace.name}. Escribe el producto en general, sin marca ni medida: «Detergente líquido», no «Deja 1 L».
        </p>
      </div>
      <NewProductForm />
    </div>
  );
}
