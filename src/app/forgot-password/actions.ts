"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { error: string | null; sent: boolean };

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Escribe un email válido.", sent: false };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  // Supabase limita cuántos correos se envían por hora.
  if (error?.status === 429) {
    return {
      error: "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.",
      sent: false,
    };
  }

  // No revelamos si el email existe: la respuesta es la misma en ambos casos.
  return { error: null, sent: true };
}
