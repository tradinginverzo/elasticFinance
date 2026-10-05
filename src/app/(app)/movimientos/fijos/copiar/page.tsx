import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { listWorkspaces } from "@/lib/workspaces";

import { CopyTemplatesForm } from "./copy-form";

export const metadata = { title: "Copiar gastos fijos" };

export default async function CopyTemplatesPage() {
  const { profile, workspace } = await requireWorkspace();
  const [templates, workspaces] = await Promise.all([
    db.transactionTemplate.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        amountCents: true,
        category: { select: { name: true, color: true } },
      },
    }),
    listWorkspaces(profile.id),
  ]);
  const targets = workspaces.filter((w) => w.id !== workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Copiar gastos fijos</h1>
        <p className="text-sm text-muted-foreground">Desde {workspace.name} a otro de tus espacios.</p>
      </div>

      {targets.length === 0 || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p className="text-muted-foreground">
              {templates.length === 0
                ? `No hay gastos fijos en ${workspace.name}.`
                : "Necesitas otro espacio para copiarlos, por ejemplo uno compartido como «Hogar»."}
            </p>
            {templates.length > 0 && (
              <Button render={<Link href="/espacios/nuevo" />} nativeButton={false}>
                Crear espacio compartido
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <CopyTemplatesForm
          sourceName={workspace.name}
          currency={workspace.currency}
          targets={targets.map(({ id, name }) => ({ id, name }))}
          templates={templates.map(({ category, ...t }) => ({
            ...t,
            amountCents: t.amountCents.toString(),
            categoryName: category?.name ?? null,
            categoryColor: category?.color ?? null,
          }))}
        />
      )}
    </div>
  );
}
