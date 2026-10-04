// Los montos se guardan en centavos (BigInt). Solo se convierten a decimales para mostrarlos.
export function formatCents(cents: bigint, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
  }).format(Number(cents) / 100);
}
