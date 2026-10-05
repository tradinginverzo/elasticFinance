"use client";

import { CalculatorIcon, HomeIcon, ListIcon, PlusIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/movimientos", label: "Movimientos", icon: ListIcon },
  { href: "/cuentas", label: "Cuentas", icon: WalletIcon },
  { href: "/simulador", label: "Simulador", icon: CalculatorIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // "/movimientos/nuevo" tiene su propio botón: no marca "Movimientos".
  return pathname.startsWith(href) && pathname !== "/movimientos/nuevo";
}

// Escritorio: enlaces en la cabecera.
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
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
  const [home, transactions, accounts, simulator] = LINKS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {[home, transactions].map((link) => (
          <MobileLink key={link.href} {...link} active={isActive(pathname, link.href)} />
        ))}
        <Link
          href="/movimientos/nuevo"
          aria-label="Nuevo movimiento"
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
        >
          <PlusIcon className="size-6" />
        </Link>
        {[accounts, simulator].map((link) => (
          <MobileLink key={link.href} {...link} active={isActive(pathname, link.href)} />
        ))}
      </div>
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
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 text-[11px] text-muted-foreground",
        active && "text-primary",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
