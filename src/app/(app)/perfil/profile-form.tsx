"use client";

import Link from "next/link";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";

import { saveProfile, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { error: null };

export function ProfileForm({
  firstName,
  lastName,
}: {
  firstName: string | null;
  lastName: string | null;
}) {
  const { state, onSubmit, pending } = useFormAction(saveProfile, initialState);

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">Nombre</Label>
        <Input
          id="firstName"
          name="firstName"
          autoComplete="off"
          className="h-10"
          defaultValue={firstName ?? ""}
          maxLength={50}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lastName">Apellido</Label>
        <Input
          id="lastName"
          name="lastName"
          autoComplete="off"
          className="h-10"
          defaultValue={lastName ?? ""}
          maxLength={50}
        />
      </div>

      <FormError message={state.error} />

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-10 flex-1" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-10"
          render={<Link href="/" />}
          nativeButton={false}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
