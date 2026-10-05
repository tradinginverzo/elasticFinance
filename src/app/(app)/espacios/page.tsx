import { ChevronRightIcon, HomeIcon, LockIcon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { listWorkspaces } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

export const metadata = { title: "Espacios" };

export default async function SpacesPage() {
  const { profile, workspace: active } = await requireWorkspace();
  const workspaces = await listWorkspaces(profile.id);
  const memberCounts = await db.workspaceMember.groupBy({
    by: ["workspaceId"],
    where: { workspaceId: { in: workspaces.map((w) => w.id) } },
    _count: true,
  });
  const countOf = (id: string) => memberCounts.find((m) => m.workspaceId === id)?._count ?? 1;
  const shared = workspaces.filter((w) => w.kind === "SHARED");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Espacios</h1>
          <p className="text-sm text-muted-foreground">
            Tu espacio personal es solo tuyo. En los compartidos, todos los miembros ven y registran lo mismo.
          </p>
        </div>
        <Button render={<Link href="/espacios/nuevo" />} nativeButton={false} className="h-9 shrink-0">
          <PlusIcon />
          Nuevo
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {workspaces.map((w) => {
          const Icon = w.kind === "PERSONAL" ? LockIcon : HomeIcon;
          return (
            <li key={w.id}>
              <Link href={`/espacios/${w.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    w.kind === "PERSONAL" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {w.name}
                    {w.id === active.id && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        Activo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.kind === "PERSONAL"
                      ? "Personal · solo tú"
                      : `Compartido · ${countOf(w.id)} ${countOf(w.id) === 1 ? "miembro" : "miembros"} · ${w.role === "OWNER" ? "administras" : "miembro"}`}
                  </p>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      {shared.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersIcon className="size-6" />
            </span>
            <div>
              <p className="font-medium">Comparte las finanzas del hogar</p>
              <p className="text-sm text-muted-foreground">
                Crea un espacio compartido (por ejemplo «Hogar») y añade a las personas con quienes
                compartes gastos. Cada uno conserva además su espacio personal.
              </p>
            </div>
            <Button render={<Link href="/espacios/nuevo" />} nativeButton={false}>
              Crear espacio compartido
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
