"use client";

import { useActionState, useTransition } from "react";

// Envía un formulario a una Server Action con onSubmit (en vez de <form action>), para que
// React no vacíe los campos si la acción devuelve un error de validación.
export function useFormAction<State extends object>(
  action: (prev: State, formData: FormData) => Promise<State>,
  initialState: State,
) {
  const [state, formAction, actionPending] = useActionState<State, FormData>(
    action as (prev: Awaited<State>, formData: FormData) => Promise<State>,
    initialState as Awaited<State>,
  );
  const [transitionPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state, onSubmit, pending: actionPending || transitionPending };
}
