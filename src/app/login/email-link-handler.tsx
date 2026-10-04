"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { markPasswordResetRequired } from "./email-link-actions";

// Los correos con la plantilla por defecto de Supabase (p. ej. "Send password recovery"
// desde el panel) vuelven a la app con la sesión en el fragmento de la URL
// (#access_token=...&type=recovery). El servidor no ve el fragmento, así que lo procesamos aquí.
export function EmailLinkHandler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!hash.has("access_token") && !hash.has("error")) return;

    // Quitamos los tokens de la barra de direcciones y del historial.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (hash.has("error") || !accessToken || !refreshToken) {
      // Diferimos el aviso para no actualizar el estado en el mismo render del efecto.
      queueMicrotask(() => setError("El enlace no es válido o ya caducó. Pide uno nuevo."));
      return;
    }

    createSupabaseBrowserClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ error }) => {
        if (error) {
          setError("El enlace no es válido o ya caducó. Pide uno nuevo.");
          return;
        }
        if (hash.get("type") === "recovery") {
          await markPasswordResetRequired();
          router.replace("/reset-password");
        } else {
          router.replace("/");
        }
      });
  }, [router]);

  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </p>
  );
}
