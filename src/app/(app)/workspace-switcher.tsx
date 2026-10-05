"use client";

import { ChevronsUpDownIcon, HomeIcon, LockIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { switchWorkspace } from "./actions";

type WorkspaceOption = { id: string; name: string; kind: "PERSONAL" | "SHARED" };

function WorkspaceIcon({ kind }: { kind: WorkspaceOption["kind"] }) {
  const Icon = kind === "PERSONAL" ? LockIcon : HomeIcon;
  return <Icon className="size-4 text-muted-foreground" />;
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceOption[];
  activeId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[pending=true]:opacity-60"
        data-pending={pending}
      >
        <WorkspaceIcon kind={active.kind} />
        <span className="max-w-32 truncate">{active.name}</span>
        <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Espacios</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={active.id}
            onValueChange={(id: string) =>
              startTransition(() => switchWorkspace(id))
            }
          >
            {workspaces.map((w) => (
              <DropdownMenuRadioItem key={w.id} value={w.id}>
                <WorkspaceIcon kind={w.kind} />
                {w.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/espacios/nuevo")}>
          <PlusIcon />
          Nuevo espacio compartido
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/espacios")}>
          <SettingsIcon />
          Administrar espacios
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
