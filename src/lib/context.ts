import "server-only";

import { requireProfile } from "@/lib/auth";
import { getActiveWorkspace, listWorkspaces } from "@/lib/workspaces";

// Usuario con sesión + espacio activo. Punto de partida de páginas y acciones protegidas.
export async function requireWorkspace() {
  const profile = await requireProfile();
  const workspace = await getActiveWorkspace(profile.id);
  return { profile, workspace };
}

// Comprueba que el usuario pertenece al espacio de un registro antes de modificarlo.
export async function isMemberOf(userId: string, workspaceId: string) {
  const workspaces = await listWorkspaces(userId);
  return workspaces.some((w) => w.id === workspaceId);
}
