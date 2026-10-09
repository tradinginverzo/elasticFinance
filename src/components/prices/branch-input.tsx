"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Sucursal opcional del supermercado ("Las Américas"), con las ya usadas como sugerencia.
export function BranchInput({
  value,
  onChange,
  onBlur,
  suggestions = [],
  className,
  id,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  suggestions?: string[];
  className?: string;
  id?: string;
  name?: string;
}) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        name={name}
        aria-label="Sucursal (opcional)"
        autoComplete="off"
        placeholder="Sucursal (opcional): Las Américas, El Vergel…"
        className={cn("h-10", className)}
        maxLength={60}
        list={suggestions.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}
