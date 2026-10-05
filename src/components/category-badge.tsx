import { FALLBACK_CATEGORY_COLOR } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

// Insignia redonda con la inicial de la categoría sobre su color. El nombre completo va en
// el tooltip y para lectores de pantalla (la identidad no depende solo del color).
export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string | null;
  color: string | null;
  className?: string;
}) {
  const label = name ?? "Sin categoría";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-semibold text-white select-none",
        className,
      )}
      style={{ backgroundColor: name ? (color ?? FALLBACK_CATEGORY_COLOR) : FALLBACK_CATEGORY_COLOR }}
    >
      <span aria-hidden>{name ? name.trim().charAt(0).toUpperCase() : "–"}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
