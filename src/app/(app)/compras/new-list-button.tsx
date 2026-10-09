"use client";

import { PlusIcon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { createList } from "./actions";

export function NewListButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button className="h-9" disabled={pending} onClick={() => startTransition(async () => void (await createList()))}>
      <PlusIcon />
      {pending ? "Creando…" : "Nueva lista"}
    </Button>
  );
}
