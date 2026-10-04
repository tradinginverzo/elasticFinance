"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { clearPasswordReset } from "@/lib/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, listWorkspaces } from "@/lib/workspaces";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  await clearPasswordReset();
  redirect("/login");
}

export async function switchWorkspace(workspaceId: string) {
  const profile = await requireProfile();
  const workspaces = await listWorkspaces(profile.id);
  // Solo se puede activar un espacio del que el usuario es miembro.
  if (!workspaces.some((w) => w.id === workspaceId)) return;

  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
