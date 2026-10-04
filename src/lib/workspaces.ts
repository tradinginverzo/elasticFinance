import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { requireProfile } from "@/lib/auth";

export const ACTIVE_WORKSPACE_COOKIE = "ef-workspace";

// Espacios del usuario actual: primero el personal, luego los compartidos por nombre.
// Salen del mismo perfil que carga requireProfile(), sin otra consulta a la base.
export const listWorkspaces = cache(async (userId: string) => {
  const profile = await requireProfile();
  if (profile.id !== userId) throw new Error("listWorkspaces: solo para el usuario actual");

  return profile.memberships
    .map((m) => ({ ...m.workspace, role: m.role }))
    .sort((a, b) =>
      a.kind === b.kind
        ? a.name.localeCompare(b.name, "es")
        : a.kind === "PERSONAL"
          ? -1
          : 1,
    );
});

export type UserWorkspace = Awaited<ReturnType<typeof listWorkspaces>>[number];

// Espacio elegido en el selector (cookie). Si no es válido, el personal.
export const getActiveWorkspace = cache(async (userId: string) => {
  const workspaces = await listWorkspaces(userId);
  const selectedId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;

  return (
    workspaces.find((w) => w.id === selectedId) ??
    workspaces.find((w) => w.kind === "PERSONAL") ??
    workspaces[0]
  );
});
