import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/context";
import { db } from "@/lib/db";
import { fullName, profileNameSelect } from "@/lib/profile-name";
import { listWorkspaces } from "@/lib/workspaces";

import {
  ActivateSpaceButton,
  AddMemberForm,
  DeleteSpaceButton,
  LeaveSpaceButton,
  RemoveMemberButton,
  RenameSpaceForm,
} from "../space-forms";

export const metadata = { title: "Espacio" };

export default async function SpacePage({ params }: PageProps<"/espacios/[id]">) {
  const { id } = await params;
  const { profile, workspace: active } = await requireWorkspace();
  // Solo espacios de los que el usuario es miembro.
  const workspace = (await listWorkspaces(profile.id)).find((w) => w.id === id);
  if (!workspace) notFound();

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: id },
    include: { user: { select: { id: true, ...profileNameSelect } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  const isOwner = workspace.role === "OWNER";
  const isShared = workspace.kind === "SHARED";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/espacios" className="flex w-fit items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Espacios
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-sm text-muted-foreground">
          {isShared
            ? `Espacio compartido · ${isOwner ? "lo administras tú" : "eres miembro"}`
            : "Tu espacio personal: solo tú lo ves."}
        </p>
      </div>

      {workspace.id !== active.id && <ActivateSpaceButton workspaceId={workspace.id} />}

      {isShared && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            {isOwner && <RenameSpaceForm workspaceId={workspace.id} name={workspace.name} />}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Miembros ({members.length})</p>
              <ul className="divide-y rounded-xl border">
                {members.map((m) => {
                  const name = fullName(m.user);
                  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {name}
                          {m.userId === profile.id && <span className="font-normal text-muted-foreground"> (tú)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.role === "OWNER" ? "Administrador" : "Miembro"} · {m.user.email}
                        </p>
                      </div>
                      {isOwner && m.userId !== profile.id && (
                        <RemoveMemberButton workspaceId={workspace.id} userId={m.userId} name={name} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {isOwner && <AddMemberForm workspaceId={workspace.id} />}
          </CardContent>
        </Card>
      )}

      {isShared && (
        <div className="flex flex-col gap-2 border-t pt-6">
          {isOwner ? (
            <DeleteSpaceButton workspaceId={workspace.id} name={workspace.name} />
          ) : (
            <LeaveSpaceButton workspaceId={workspace.id} name={workspace.name} />
          )}
        </div>
      )}
    </div>
  );
}
