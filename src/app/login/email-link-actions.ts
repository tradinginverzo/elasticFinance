"use server";

import { requirePasswordReset } from "@/lib/password-reset";

// Lo llama EmailLinkHandler tras abrir la sesión con un enlace de recuperación.
export async function markPasswordResetRequired() {
  await requirePasswordReset();
}
