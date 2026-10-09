import { Logo } from "@/components/logo";
import { findWaitingSession } from "@/lib/capture";

import { PhoneCapture } from "./phone-capture";

export const metadata = {
  title: "Tomar foto de factura",
  robots: { index: false, follow: false },
  referrer: "no-referrer", // el enlace lleva el token
};

// Se abre en el teléfono al escanear el QR del PC. No requiere iniciar sesión: el token
// (de un solo uso, 10 minutos) solo permite subir una factura a ese espacio.
export default async function CapturePage({ params }: PageProps<"/captura/[token]">) {
  const { token } = await params;
  const session = await findWaitingSession(token);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Logo />
      {session ? (
        <PhoneCapture token={token} workspaceName={session.workspace.name} />
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Código caducado</h1>
          <p className="text-muted-foreground">
            Este código ya se usó o pasaron más de 10 minutos. En el PC, toca otra vez «Tomar la foto con el
            teléfono» para generar uno nuevo.
          </p>
        </div>
      )}
    </main>
  );
}
