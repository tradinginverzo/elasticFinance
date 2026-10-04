import Link from "next/link";
import { redirect } from "next/navigation";

import { EnvBadge } from "@/components/env-badge";
import { Logo } from "@/components/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { EmailLinkHandler } from "./email-link-handler";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Logo />
        <EnvBadge />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Usa el email y la contraseña de tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error === "link" && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              El enlace no es válido o ya caducó. Pide uno nuevo.
            </p>
          )}
          <EmailLinkHandler />
          <LoginForm />
          <Link
            href="/forgot-password"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
