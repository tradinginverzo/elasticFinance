// En español Intl no separa los miles con 4 cifras ("4738,36"); "always" da "4.738,36".
const GROUPING = { useGrouping: "always" } as const;

// Los montos se guardan en centavos (BigInt). Solo se convierten a decimales para mostrarlos.
export function formatCents(cents: bigint, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    ...GROUPING,
  }).format(Number(cents) / 100);
}

// Igual que formatCents pero para cálculos en number (p. ej. el simulador).
export function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    ...GROUPING,
  }).format(Math.round(cents) / 100);
}

// Convierte lo que escribe el usuario a centavos. Acepta formatos como
// "1234", "1234.5", "1234,50", "1.234,50", "1,234.50" y "1.500" (= mil quinientos).
// Devuelve null si no es un número válido.
export function parseAmountToCents(input: string): bigint | null {
  const raw = input.replace(/[\s$€]/g, "");
  if (!/^\d[\d.,]*$/.test(raw)) return null;

  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let integerPart: string;
  let decimalPart = "";

  if (lastDot !== -1 && lastComma !== -1) {
    // Hay ambos: el que aparece último es el separador decimal.
    const decimalIndex = Math.max(lastDot, lastComma);
    const groups = raw.slice(0, decimalIndex).split(/[.,]/);
    if (groups.slice(1).some((g) => g.length !== 3)) return null;
    integerPart = groups.join("");
    decimalPart = raw.slice(decimalIndex + 1);
  } else {
    const separator = lastDot !== -1 ? "." : lastComma !== -1 ? "," : null;
    const parts = separator ? raw.split(separator) : [raw];
    // Un solo separador seguido de exactamente 3 dígitos (o varios separadores) = miles.
    const isThousands =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    if (!separator || isThousands) {
      // Separadores de miles: todos los grupos tras el primero deben tener 3 dígitos.
      if (parts.slice(1).some((p) => p.length !== 3)) return null;
      integerPart = parts.join("");
    } else {
      integerPart = parts[0];
      decimalPart = parts[1];
    }
  }

  if (decimalPart.length > 2 || !/^\d*$/.test(decimalPart)) return null;
  if (!/^\d+$/.test(integerPart)) return null;

  return BigInt(integerPart) * BigInt(100) + BigInt(decimalPart.padEnd(2, "0") || "0");
}

// Para rellenar un campo de monto al editar: 123456n → "1234,56".
export function centsToInput(cents: bigint) {
  const abs = cents < BigInt(0) ? -cents : cents;
  const units = abs / BigInt(100);
  const rest = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${cents < BigInt(0) ? "-" : ""}${units},${rest}`;
}
