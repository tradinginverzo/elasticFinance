import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { requirePasswordReset } from "@/lib/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Destino de los enlaces que envía Supabase por correo (p. ej. "restablecer contraseña").
// Acepta los dos formatos: ?token_hash=...&type=... (plantilla de correo propia) y ?code=... (PKCE).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createSupabaseServerClient();

  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token") };

  if (error) {
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }
  if (type === "recovery" || next === "/reset-password") {
    await requirePasswordReset();
  }
  return NextResponse.redirect(new URL(next, origin));
}

// Solo rutas internas: evita que un enlace manipulado redirija a otro sitio.
function safeNextPath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
