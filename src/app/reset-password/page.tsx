import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { isPasswordResetRequired } from "@/lib/password-reset";

import { signOut } from "../(app)/actions";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nueva contraseña" };

// Se llega aquí desde el enlace del correo (vía /auth/confirm, que ya inició la sesión)
// o desde la app para cambiar la contraseña.
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=link");
  const resetRequired = await isPasswordResetRequired();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nueva contraseña</CardTitle>
          <CardDescription>
            Elige una contraseña para {user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ResetPasswordForm />
          {resetRequired ? (
            // Entró con un enlace de recuperación: no puede volver a la app sin cambiarla.
            <form action={signOut} className="text-center">
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar y cerrar sesión
              </button>
            </form>
          ) : (
            <Link
              href="/"
              className="text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
