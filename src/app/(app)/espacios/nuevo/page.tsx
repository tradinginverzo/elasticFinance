import { requireProfile } from "@/lib/auth";

import { CreateSpaceForm } from "../space-forms";

export const metadata = { title: "Nuevo espacio compartido" };

export default async function NewSpacePage() {
  await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo espacio compartido</h1>
        <p className="text-sm text-muted-foreground">
          Serás su administrador. Después podrás añadir a otras personas por su email.
        </p>
      </div>
      <CreateSpaceForm />
    </div>
  );
}
