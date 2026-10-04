import "server-only";

import { cookies } from "next/headers";

// Marca que la sesión actual se abrió con un enlace de recuperación: hasta que el usuario
// guarde una contraseña nueva, la app solo le deja ver /reset-password.
const COOKIE = "ef-password-reset-required";

export async function requirePasswordReset() {
  (await cookies()).set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function isPasswordResetRequired() {
  return (await cookies()).has(COOKIE);
}

export async function clearPasswordReset() {
  (await cookies()).delete(COOKIE);
}
