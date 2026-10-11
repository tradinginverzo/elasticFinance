// Se muestra al instante al navegar entre páginas de la app mientras el servidor prepara la
// nueva (todas son dinámicas: sin esto, al tocar el menú no pasaba nada hasta tener los datos).
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-44 rounded-lg bg-muted" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 rounded-xl bg-muted/70" />
        <div className="h-16 rounded-xl bg-muted/70" />
        <div className="h-16 rounded-xl bg-muted/70" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
