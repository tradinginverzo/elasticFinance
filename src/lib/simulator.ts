// Simulador: proyecta el saldo mes a mes con y sin un gasto o ingreso.
// Todo en centavos (number). Es una proyección con tus promedios, no una predicción.

export type Baseline = {
  balance: number; // saldo actual (suma de cuentas)
  monthlyIncome: number;
  monthlyExpense: number;
};

export type Scenario =
  | { kind: "purchase"; payment: "cash"; amount: number }
  | {
      kind: "purchase";
      payment: "credit";
      amount: number;
      downPayment: number;
      installments: number;
      installmentAmount: number;
      firstMonth: 0 | 1; // 0 = la primera cuota se paga este mes, 1 = el mes que viene
    }
  | {
      kind: "income";
      amount: number;
      recurrence: "once" | "monthly";
      months: number | null; // solo si es mensual; null = todo el periodo
      firstMonth: 0 | 1;
    }
  | {
      // Gasto fijo (p. ej. una suscripción): añadir uno nuevo o cancelar uno existente.
      kind: "recurring";
      action: "add" | "cancel";
      amount: number; // monto mensual
      firstMonth: 0 | 1;
    };

export type ProjectionPoint = { index: number; baseline: number; withScenario: number };

// Cuota fija mensual (sistema francés). annualRatePercent = tasa nominal anual en %.
export function installmentFromRate(principal: number, annualRatePercent: number, n: number) {
  if (n <= 0 || principal <= 0) return 0;
  const i = annualRatePercent / 100 / 12;
  if (i === 0) return Math.round(principal / n);
  return Math.round((principal * i) / (1 - Math.pow(1 + i, -n)));
}

// Cuánto cambia el saldo por el escenario en cada punto (0 = hoy, k = dentro de k meses).
function scenarioFlows(scenario: Scenario, horizon: number) {
  const flows = new Array<number>(horizon + 1).fill(0);
  const add = (index: number, value: number) => {
    if (index >= 0 && index <= horizon) flows[index] += value;
  };

  if (scenario.kind === "purchase" && scenario.payment === "cash") {
    add(0, -scenario.amount);
  } else if (scenario.kind === "purchase") {
    add(0, -scenario.downPayment);
    for (let i = 0; i < scenario.installments; i++) {
      add(scenario.firstMonth + i, -scenario.installmentAmount);
    }
  } else if (scenario.kind === "recurring") {
    // Añadir = sale cada mes; cancelar = deja de salir cada mes (lo ahorras).
    const monthly = scenario.action === "add" ? -scenario.amount : scenario.amount;
    for (let k = scenario.firstMonth; k <= horizon; k++) add(k, monthly);
  } else if (scenario.recurrence === "once") {
    add(scenario.firstMonth, scenario.amount);
  } else {
    const months = scenario.months ?? horizon + 1;
    for (let i = 0; i < months; i++) add(scenario.firstMonth + i, scenario.amount);
  }
  return flows;
}

export function simulate(base: Baseline, scenario: Scenario, horizon: number) {
  const monthlySavings = base.monthlyIncome - base.monthlyExpense;
  const flows = scenarioFlows(scenario, horizon);

  const points: ProjectionPoint[] = [];
  let baseline = base.balance;
  let cumulative = 0;
  for (let k = 0; k <= horizon; k++) {
    if (k > 0) baseline += monthlySavings;
    cumulative += flows[k];
    points.push({ index: k, baseline, withScenario: baseline + cumulative });
  }

  const final = points[points.length - 1];
  const lowest = points.reduce((min, p) => (p.withScenario < min.withScenario ? p : min));
  const firstNegative = points.find((p) => p.withScenario < 0) ?? null;

  return {
    points,
    monthlySavings,
    finalBaseline: final.baseline,
    finalWithScenario: final.withScenario,
    difference: final.withScenario - final.baseline,
    lowest,
    firstNegative,
    credit: scenario.kind === "purchase" && scenario.payment === "credit" ? creditSummary(scenario, base) : null,
    // Contado: meses de ahorro para recuperar lo gastado (null si no ahorras cada mes).
    recoveryMonths:
      scenario.kind === "purchase" && scenario.payment === "cash" && monthlySavings > 0
        ? Math.ceil(scenario.amount / monthlySavings)
        : null,
  };
}

function creditSummary(
  scenario: Extract<Scenario, { payment: "credit" }>,
  base: Baseline,
) {
  const totalPaid = scenario.downPayment + scenario.installments * scenario.installmentAmount;
  return {
    installmentAmount: scenario.installmentAmount,
    totalPaid,
    interest: totalPaid - scenario.amount,
    // Qué parte de tu ingreso mensual se lleva la cuota.
    shareOfIncome: base.monthlyIncome > 0 ? scenario.installmentAmount / base.monthlyIncome : null,
    lastMonth: scenario.firstMonth + scenario.installments - 1,
  };
}

export type SimulationResult = ReturnType<typeof simulate>;
