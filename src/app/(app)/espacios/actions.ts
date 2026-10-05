"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, listWorkspaces } from "@/lib/workspaces";

export type SpaceFormState = { error: string | null; success?: string | null };

const nameSchema = z.string().trim().min(1, "Ponle un nombre, por ejemplo Hogar.").max(40);

// Rol del usuario actual en un espacio (null si no es miembro).
async function roleIn(workspaceId: string) {
  const profile = await requireProfile();
  const workspace = (await listWorkspaces(profile.id)).find((w) => w.id === workspaceId);
  return { profile, workspace, role: workspace?.role ?? null };
}

async function setActiveWorkspace(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createSharedWorkspace(
  _prev: SpaceFormState,
  formData: FormData,
): Promise<SpaceFormState> {
  const profile = await requireProfile();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const workspace = await db.workspace.create({
    data: {
      name: parsed.data,
      kind: "SHARED",
      members: { create: { userId: profile.id, role: "OWNER" } },
    },
  });
  // Lo dejamos activo para empezar a usarlo directamente.
  await setActiveWorkspace(workspace.id);
  redirect(`/espacios/${workspace.id}`);
}

export async function renameWorkspace(
  workspaceId: string,
  _prev: SpaceFormState,
  formData: FormData,
): Promise<SpaceFormState> {
  const { workspace, role } = await roleIn(workspaceId);
  if (!workspace || role !== "OWNER") return { error: "Solo el administrador puede cambiar el nombre." };
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.workspace.update({ where: { id: workspaceId }, data: { name: parsed.data } });
  return { error: null, success: "Nombre guardado." };
}

// Añade a una persona por su email. Debe tener una cuenta en Supabase Auth (el registro está
// cerrado: las cuentas se crean desde el panel). Si aún no ha entrado en la app, le creamos el
// perfil; su espacio personal se creará la primera vez que entre.
export async function addMember(
  workspaceId: string,
  _prev: SpaceFormState,
  formData: FormData,
): Promise<SpaceFormState> {
  const { workspace, role } = await roleIn(workspaceId);
  if (!workspace || workspace.kind !== "SHARED" || role !== "OWNER") {
    return { error: "Solo el administrador de un espacio compartido puede añadir miembros." };
  }
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Escribe un email válido." };
  const email = parsed.data;

  let profile = await db.profile.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!profile) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return { error: "No se pudo buscar la cuenta. Inténtalo de nuevo." };
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return {
        error: "No hay ninguna cuenta con ese email. Créala primero en Supabase (Authentication → Users).",
      };
    }
    profile = await db.profile.upsert({
      where: { id: user.id },
      create: { id: user.id, email },
      update: {},
    });
  }

  const already = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: profile.id } },
  });
  if (already) return { error: "Esa persona ya es miembro de este espacio." };

  await db.workspaceMember.create({ data: { workspaceId, userId: profile.id, role: "MEMBER" } });
  return { error: null, success: `${email} ya es miembro de ${workspace.name}.` };
}

export async function removeMember(workspaceId: string, userId: string): Promise<SpaceFormState> {
  const { profile, workspace, role } = await roleIn(workspaceId);
  if (!workspace || role !== "OWNER") return { error: "Solo el administrador puede quitar miembros." };
  if (userId === profile.id) return { error: "No puedes quitarte a ti mismo: elimina el espacio si ya no lo usas." };

  await db.workspaceMember.deleteMany({ where: { workspaceId, userId } });
  return { error: null };
}

// Un miembro (no administrador) deja el espacio. Sus movimientos se quedan en el espacio.
export async function leaveWorkspace(workspaceId: string): Promise<SpaceFormState> {
  const { profile, workspace, role } = await roleIn(workspaceId);
  if (!workspace || workspace.kind !== "SHARED") return { error: "Ese espacio no existe." };
  if (role === "OWNER") return { error: "El administrador no puede salir: elimina el espacio si ya no lo usas." };

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: profile.id } },
  });
  redirect("/espacios");
}

// Elimina un espacio compartido con todo lo que contiene (cuentas, movimientos, gastos fijos…).
export async function deleteWorkspace(workspaceId: string): Promise<SpaceFormState> {
  const { workspace, role } = await roleIn(workspaceId);
  if (!workspace || workspace.kind !== "SHARED" || role !== "OWNER") {
    return { error: "Solo el administrador puede eliminar un espacio compartido." };
  }
  await db.workspace.delete({ where: { id: workspaceId } });
  redirect("/espacios");
}

export async function activateWorkspace(workspaceId: string) {
  const { workspace } = await roleIn(workspaceId);
  if (!workspace) return;
  await setActiveWorkspace(workspaceId);
  redirect("/");
}
