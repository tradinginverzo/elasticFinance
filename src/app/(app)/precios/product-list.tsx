"use client";

import { ChevronRightIcon, SearchIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type ProductRow = {
  id: string;
  name: string;
  storeCount: number;
  best: { storeName: string; detail: string; unitPrice: string } | null;
  offerStore: string | null; // supermercado con una oferta reciente aún más barata
};

export function ProductList({ products }: { products: ProductRow[] }) {
  const [query, setQuery] = useState("");
  const text = query.trim().toLocaleLowerCase("es");
  const visible = text ? products.filter((p) => p.name.toLocaleLowerCase("es").includes(text)) : products;

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TagIcon className="size-6" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Aquí verás en qué supermercado sale más barato cada producto. Los precios llegan solos al
            marcar tu lista de compras o al leer tus facturas, o puedes escribirlos a mano.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {products.length > 6 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto…"
            autoComplete="off"
            className="h-10 pl-8"
          />
        </div>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {visible.map((p) => (
          <li key={p.id}>
            <Link href={`/precios/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.best
                    ? `Mejor en ${p.best.storeName} · ${p.best.detail}`
                    : p.storeCount > 0
                      ? "Solo precios en oferta"
                      : "Sin precios todavía"}
                </p>
                {p.offerStore && (
                  <p className="truncate text-xs font-medium text-income">Oferta reciente en {p.offerStore}</p>
                )}
              </div>
              {p.best && (
                <span className="text-sm font-semibold whitespace-nowrap tabular-nums">{p.best.unitPrice}</span>
              )}
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin resultados.</li>}
      </ul>
    </div>
  );
}
