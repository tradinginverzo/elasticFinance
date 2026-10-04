import { requireWorkspace } from "@/lib/context";

import { AccountForm } from "../account-form";

export const metadata = { title: "Nueva cuenta" };

export default async function NewAccountPage() {
  const { workspace } = await requireWorkspace();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva cuenta</h1>
        <p className="text-sm text-muted-foreground">En {workspace.name}</p>
      </div>
      <AccountForm currency={workspace.currency} />
    </div>
  );
}
