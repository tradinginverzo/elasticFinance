"use client";

import {
  CalculatorIcon,
  EllipsisIcon,
  HomeIcon,
  ListIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TagIcon,
  WalletIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/movimientos", label: "Movimientos", icon: ListIcon },
  { href: "/cuentas", label: "Cuentas", icon: WalletIcon },
  { href: "/compras", label: "Compras", icon: ShoppingCartIcon },
  { href: "/precios", label: "Precios", icon: TagIcon },
  { href: "/facturas", label: "Facturas", icon: ReceiptIcon },
  { href: "/simulador", label: "Simulador", icon: CalculatorIcon },
];

// En el móvil: barra con Inicio, Movimientos, "+", Compras y "Más" (el resto).
const MOBILE_BAR = ["/", "/movimientos", "/compras"];
const MORE_LINKS = LINKS.filter((l) => !MOBILE_BAR.includes(l.href));

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // "/movimientos/nuevo" tiene su propio botón: no marca "Movimientos".
  return pathname.startsWith(href) && pathname !== "/movimientos/nuevo";
}

// Escritorio: enlaces en la cabecera.
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
            isActive(pathname, href) && "bg-muted font-medium text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Móvil: barra fija abajo, con el botón "+" en el centro para registrar rápido.
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [home, transactions, shopping] = MOBILE_BAR.map((href) => LINKS.find((l) => l.href === href)!);
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {[home, transactions].map((link) => (
          <MobileLink key={link.href} {...link} active={isActive(pathname, link.href)} />
        ))}
        <Link
          href="/movimientos/nuevo"
          aria-label="Nuevo movimiento"
          className="mx-auto flex size-12 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
        >
          <PendingIcon icon={PlusIcon} className="size-6" />
        </Link>
        <MobileLink {...shopping} active={isActive(pathname, shopping.href)} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex h-full w-full touch-manipulation flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground active:bg-muted/60",
            moreActive && "text-primary",
          )}
        >
          <EllipsisIcon className="size-5" />
          Más
        </button>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Más</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {MORE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex touch-manipulation items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted active:bg-muted",
                  isActive(pathname, href) && "border-primary/40 bg-primary/5 text-primary",
                )}
              >
                <PendingIcon icon={Icon} className="size-5" />
                {label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
}: (typeof LINKS)[number] & { active: boolean }) {
  return (
    // Toda la celda responde al toque (no solo el ícono y el texto).
    <Link
      href={href}
      className={cn(
        "flex h-full w-full touch-manipulation flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground active:bg-muted/60",
        active && "text-primary",
      )}
    >
      <PendingIcon icon={Icon} className="size-5" />
      {label}
    </Link>
  );
}

// Ícono que late mientras carga la página del enlace tocado (aviso de que el toque sí entró).
function PendingIcon({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  const { pending } = useLinkStatus();
  return <Icon className={cn(className, pending && "animate-pulse opacity-60")} />;
}
