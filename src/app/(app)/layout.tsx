import Link from "next/link";

import { EnvBadge } from "@/components/env-badge";
import { Logo } from "@/components/logo";
import { requireProfile } from "@/lib/auth";
import { getActiveWorkspace, listWorkspaces } from "@/lib/workspaces";

import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const [workspaces, active] = await Promise.all([
    listWorkspaces(profile.id),
    getActiveWorkspace(profile.id),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="hidden sm:block">
            <Logo />
          </Link>
          <EnvBadge />
          <WorkspaceSwitcher
            workspaces={workspaces.map(({ id, name, kind }) => ({ id, name, kind }))}
            activeId={active.id}
          />
          <div className="ml-auto">
            <UserMenu
              name={profile.displayName ?? profile.email.split("@")[0]}
              email={profile.email}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
