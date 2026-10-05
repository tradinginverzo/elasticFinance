// Las transacciones guardan solo la fecha (sin hora), como medianoche UTC.
// Todas las conversiones usan UTC para que el día no cambie según la zona horaria.

// Date → "2026-10-04" (valor de un <input type="date">).
export function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

// "2026-10-04" → Date (medianoche UTC). Null si no es una fecha válida.
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || toDateInput(date) !== value ? null : date;
}

// Fecha de hoy en la zona horaria del usuario, como "2026-10-04".
export function todayInput(timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...options,
  }).format(date);
}

// "2026-10" → { start, end } del mes en UTC (end exclusivo).
export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, m - 1, 1)),
    end: new Date(Date.UTC(year, m, 1)),
  };
}

export function currentMonth() {
  return todayInput().slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return toDateInput(date).slice(0, 7);
}

export function formatMonth(month: string) {
  const { start } = monthRange(month);
  return new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
}
