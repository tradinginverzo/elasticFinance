"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { deleteStore, renameStore } from "../actions";

export function StoreList({ stores }: { stores: { id: string; name: string; prices: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Aún no hay supermercados.</CardContent>
      </Card>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {stores.map((s) => (
        <li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
          {editing === s.id ? (
            <form
              autoComplete="off"
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await renameStore(s.id, value);
                  if (result.error) toast.error(result.error);
                  else setEditing(null);
                });
              }}
            >
              <Input
                autoFocus
                autoComplete="off"
                className="h-9"
                maxLength={60}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button type="submit" size="sm" className="h-9" disabled={pending}>
                Guardar
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.prices === 1 ? "1 precio" : `${s.prices} precios`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Renombrar ${s.name}`}
                onClick={() => {
                  setEditing(s.id);
                  setValue(s.name);
                }}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${s.name}`}
                disabled={pending}
                onClick={() => {
                  if (!confirm(`¿Eliminar ${s.name} y sus ${s.prices} precios?`)) return;
                  startTransition(async () => {
                    const result = await deleteStore(s.id);
                    if (result.error) toast.error(result.error);
                  });
                }}
              >
                <Trash2Icon />
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
