import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { isPasswordResetRequired } from "@/lib/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

// Usuario de la sesión actual (o null). Cacheado por petición.
// getClaims() verifica la firma del token localmente (claves ES256 del proyecto), sin
// consultar a Supabase Auth en cada página como hacía getUser().
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

// Perfil del usuario con sus espacios, en una sola consulta. Solo escribe en la base
// la primera vez (o si cambió su email): crea el perfil y su espacio personal.
const loadProfile = cache(
  async (userId: string, email: string) => {
    const find = () =>
      db.profile.findUnique({
        where: { id: userId },
        include: { memberships: { include: { workspace: true } } },
      });

    const profile = await find();
    const hasPersonalWorkspace = profile?.memberships.some((m) => m.workspaceId === userId);
    if (profile && hasPersonalWorkspace && profile.email === email) return profile;

    // El espacio personal usa el mismo id que el usuario: así crearlo es idempotente
    // aunque lleguen varias peticiones a la vez en el primer inicio de sesión.
    await db.$transaction([
      db.profile.upsert({
        where: { id: userId },
        create: { id: userId, email },
        update: { email },
      }),
      db.workspace.upsert({
        where: { id: userId },
        create: { id: userId, name: "Personal", kind: "PERSONAL" },
        update: {},
      }),
      db.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: userId, userId } },
        create: { workspaceId: userId, userId, role: "OWNER" },
        update: {},
      }),
    ]);
    return (await find())!;
  },
);

// Exige sesión iniciada y devuelve el perfil (con sus espacios).
// Úsalo al inicio de cualquier página o acción protegida.
export const requireProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user?.email) redirect("/login");
  // Entró con un enlace de recuperación: primero debe guardar una contraseña nueva.
  if (await isPasswordResetRequired()) redirect("/reset-password");

  return loadProfile(user.id, user.email);
});
