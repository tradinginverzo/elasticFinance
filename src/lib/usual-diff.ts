// Compara el monto registrado con el monto habitual de su gasto/ingreso fijo.
// "worse" = peor para el bolsillo (gasto más alto o ingreso más bajo); "better" = al revés.
export type UsualDiff = {
  delta: number; // centavos, con signo (registrado − habitual)
  percent: number | null; // % respecto al habitual (null si el habitual es 0)
  tone: "worse" | "better";
};

export function compareToUsual(
  type: "EXPENSE" | "INCOME",
  amountCents: number,
  usualCents: number | null | undefined,
): UsualDiff | null {
  if (usualCents == null || amountCents === usualCents) return null;
  const delta = amountCents - usualCents;
  const higher = delta > 0;
  return {
    delta,
    percent: usualCents > 0 ? Math.round((delta / usualCents) * 100) : null,
    tone: (type === "EXPENSE") === higher ? "worse" : "better",
  };
}
