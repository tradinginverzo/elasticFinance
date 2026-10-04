import { createBrowserClient } from "@supabase/ssr";

// Cliente para Client Components (login, escuchar eventos en tiempo real).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
