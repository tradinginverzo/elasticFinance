"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deletePrice, deleteProduct, updateProduct } from "../actions";

export function ProductSettings({ productId, name }: { productId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <form
        autoComplete="off"
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await updateProduct(productId, value);
            setError(result.error);
            if (!result.error) toast.success("Nombre guardado");
          });
        }}
      >
        <Label htmlFor="product-name">Nombre del producto</Label>
        <div className="flex gap-2">
          <Input
            id="product-name"
            autoComplete="off"
            className="h-10"
            maxLength={60}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" variant="outline" className="h-10" disabled={pending || value.trim() === name}>
            Guardar
          </Button>
        </div>
      </form>
      <FormError message={error} />
      <Button
        variant="destructive"
        className="h-10"
        disabled={pending}
        onClick={() => {
          if (!confirm(`¿Eliminar «${name}» y todos sus precios?`)) return;
          startTransition(async () => setError((await deleteProduct(productId)).error));
        }}
      >
        Eliminar producto
      </Button>
    </section>
  );
}

export function DeletePriceButton({ priceId }: { priceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Borrar precio"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Borrar este precio?")) return;
        startTransition(async () => {
          const result = await deletePrice(priceId);
          if (result.error) toast.error(result.error);
        });
      }}
    >
      <Trash2Icon />
    </Button>
  );
}
