"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormError } from "@/components/form-error";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_UNITS, type ProductUnit } from "@/lib/units";

import { createProduct } from "../actions";

export function NewProductForm() {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("ML");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setError((await createProduct(name, unit)).error));
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Producto</Label>
        <Input
          id="name"
          autoComplete="off"
          className="h-10"
          placeholder="Detergente líquido"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Cómo se mide</Label>
        <Segmented
          label="Cómo se mide"
          value={unit}
          onChange={setUnit}
          options={PRODUCT_UNITS.map((u) => ({ value: u.value, label: u.label }))}
        />
        <p className="text-xs text-muted-foreground">
          {PRODUCT_UNITS.find((u) => u.value === unit)?.hint}. Los precios se comparan por litro, por kilo o por
          unidad, así 1 L se compara con 2 × 500 ml.
        </p>
      </div>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" className="h-10 flex-1" disabled={pending}>
          {pending ? "Guardando…" : "Crear producto"}
        </Button>
        <Button variant="outline" className="h-10" render={<Link href="/precios" />} nativeButton={false}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
