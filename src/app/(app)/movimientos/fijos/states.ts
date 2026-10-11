// Pestañas del listado de gastos fijos (?estado=…). Va aparte de state-filter.tsx porque la
// página (servidor) también las usa, y no puede leer valores de un archivo "use client".
export const STATES = [
  { value: "todos", label: "Todos" },
  { value: "por-pagar", label: "Por pagar" },
  { value: "pagados", label: "Pagados" },
] as const;
export type State = (typeof STATES)[number]["value"];
