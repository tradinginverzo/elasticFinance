"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";

import {
  activateWorkspace,
  addMember,
  createSharedWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  renameWorkspace,
  type SpaceFormState,
} from "./actions";

const initialState: SpaceFormState = { error: null, success: null };

function Success({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-income">{message}</p>;
}

export function CreateSpaceForm() {
  const { state, onSubmit, pending } = useFormAction(createSharedWorkspace, initialState);
  return (
    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del espacio</Label>
        <Input id="name" name="name" autoComplete="off" className="h-10" placeholder="Hogar, Pareja, Viaje…" maxLength={40} required />
      </div>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
          {pending ? "Creando…" : "Crear espacio"}
        </Button>
        <Button variant="outline" size="lg" className="h-10" render={<Link href="/espacios" />} nativeButton={false}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function RenameSpaceForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { state, onSubmit, pending } = useFormAction(renameWorkspace.bind(null, workspaceId), initialState);
  return (
    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-2">
      <Label htmlFor="name">Nombre</Label>
      <div className="flex gap-2">
        <Input id="name" name="name" autoComplete="off" className="h-10" defaultValue={name} maxLength={40} required />
        <Button type="submit" variant="outline" className="h-10" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <FormError message={state.error} />
      <Success message={state.success} />
    </form>
  );
}

export function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const { state, onSubmit, pending } = useFormAction(addMember.bind(null, workspaceId), initialState);
  return (
    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-2">
      <Label htmlFor="email">Añadir miembro</Label>
      <div className="flex gap-2">
        <Input
          // Remontamos tras añadir para vaciar el campo.
          key={state.success ?? "email"}
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          className="h-10"
          placeholder="correo@ejemplo.com"
          required
        />
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Añadiendo…" : "Añadir"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        La persona necesita una cuenta en la app (se crean en Supabase → Authentication → Users).
      </p>
      <FormError message={state.error} />
      <Success message={state.success} />
    </form>
  );
}

// Botón con confirmación que ejecuta una acción del servidor y muestra su error si lo hay.
function ConfirmAction({
  label,
  pendingLabel,
  confirmText,
  run,
  variant = "outline",
  className,
}: {
  label: string;
  pendingLabel: string;
  confirmText: string | (() => boolean);
  run: () => Promise<SpaceFormState | void>;
  variant?: "outline" | "destructive" | "ghost";
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function handleClick() {
    const ok = typeof confirmText === "string" ? confirm(confirmText) : confirmText();
    if (!ok) return;
    startTransition(async () => {
      const result = await run();
      setError(result?.error ?? null);
    });
  }
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant={variant} className={className} onClick={handleClick} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function RemoveMemberButton({ workspaceId, userId, name }: { workspaceId: string; userId: string; name: string }) {
  return (
    <ConfirmAction
      label="Quitar"
      pendingLabel="Quitando…"
      variant="ghost"
      className="h-8 text-destructive"
      confirmText={`¿Quitar a ${name} de este espacio? Sus movimientos se conservan.`}
      run={() => removeMember(workspaceId, userId)}
    />
  );
}

export function LeaveSpaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  return (
    <ConfirmAction
      label="Salir del espacio"
      pendingLabel="Saliendo…"
      variant="destructive"
      className="h-10"
      confirmText={`¿Salir de ${name}? Dejarás de verlo. Tus movimientos se quedan en el espacio.`}
      run={() => leaveWorkspace(workspaceId)}
    />
  );
}

export function DeleteSpaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  return (
    <ConfirmAction
      label="Eliminar espacio"
      pendingLabel="Eliminando…"
      variant="destructive"
      className="h-10"
      // Es irreversible y borra los datos de todos los miembros: pedimos escribir el nombre.
      confirmText={() =>
        prompt(
          `Se borrarán TODAS las cuentas, movimientos y gastos fijos de «${name}» para todos sus miembros. No se puede deshacer.\n\nEscribe el nombre del espacio para confirmar:`,
        )?.trim() === name
      }
      run={() => deleteWorkspace(workspaceId)}
    />
  );
}

export function ActivateSpaceButton({ workspaceId }: { workspaceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button className="h-10" disabled={pending} onClick={() => startTransition(() => activateWorkspace(workspaceId))}>
      {pending ? "Cambiando…" : "Usar este espacio"}
    </Button>
  );
}
