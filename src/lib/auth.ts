import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { isPasswordResetRequired } from "@/lib/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Usuario de Supabase Auth de la petición actual (o null). Cacheado por petición.
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Exige sesión iniciada y garantiza que el usuario tenga su perfil y su espacio personal.
// Úsalo al inicio de cualquier página o acción protegida.
export const requireProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/login");
  // Entró con un enlace de recuperación: primero debe guardar una contraseña nueva.
  if (await isPasswordResetRequired()) redirect("/reset-password");

  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null;

  // El espacio personal usa el mismo id que el usuario: así crearlo es idempotente
  // aunque lleguen varias peticiones a la vez en el primer inicio de sesión.
  const [profile] = await db.$transaction([
    db.profile.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email, displayName },
      update: { email: user.email },
    }),
    db.workspace.upsert({
      where: { id: user.id },
      create: { id: user.id, name: "Personal", kind: "PERSONAL" },
      update: {},
    }),
    db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: user.id, userId: user.id } },
      create: { workspaceId: user.id, userId: user.id, role: "OWNER" },
      update: {},
    }),
  ]);

  return profile;
});
