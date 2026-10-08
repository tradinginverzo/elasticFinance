import { getCategories } from "@/lib/categories";
import { requireWorkspace } from "@/lib/context";
import { onlyFlow } from "@/lib/transaction-types";

import { CategoryList } from "./category-list";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const { workspace } = await requireWorkspace();
  const categories = await getCategories(workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Elige el color de cada categoría de {workspace.name}. Cada una tiene un color distinto.
        </p>
      </div>
      <CategoryList
        categories={onlyFlow(categories).map(({ id, name, type, color }) => ({ id, name, type, color }))}
      />
    </div>
  );
}
