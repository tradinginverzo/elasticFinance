"use server";

import { redirect } from "next/navigation";

import { clearPasswordReset } from "@/lib/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResetPasswordState = { error: string | null };

const MIN_LENGTH = 8;

export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.` };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior."
          : "No se pudo cambiar la contraseña. Pide un enlace nuevo e inténtalo otra vez.",
    };
  }

  await clearPasswordReset();
  redirect("/");
}
