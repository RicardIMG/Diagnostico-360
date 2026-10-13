export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const decimal = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function scoreQuality(metrics) {
  const weights = { coverage: 0.35, reconciliation: 0.25, integrity: 0.2, validated: 0.2 };
  return Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + clamp(metrics[key]) * weight, 0));
}

export function qualityStatus(score) {
  if (score >= 90) return { label: "Validado", tone: "success", canRelease: true };
  if (score >= 75) return { label: "Adequado", tone: "info", canRelease: false };
  if (score >= 50) return { label: "Parcial", tone: "warning", canRelease: false };
  return { label: "Insuficiente", tone: "danger", canRelease: false };
}

export function calculateScenario({ revenue, purchases, payroll, currentRate, regularRate, eligibleCredit, fixedCosts = 0 }) {
  const safeRevenue = Math.max(0, Number(revenue) || 0);
  const safePurchases = Math.max(0, Number(purchases) || 0);
  const currentTax = safeRevenue * (Number(currentRate) || 0) / 100;
  const debit = safeRevenue * (Number(regularRate) || 0) / 100;
  const credit = safePurchases * (Number(regularRate) || 0) / 100 * clamp(eligibleCredit) / 100;
  const regularTax = Math.max(0, debit - credit);
  const currentMargin = safeRevenue - safePurchases - (Number(payroll) || 0) - currentTax - (Number(fixedCosts) || 0);
  const regularMargin = safeRevenue - safePurchases - (Number(payroll) || 0) - regularTax - (Number(fixedCosts) || 0);
  return {
    currentTax,
    debit,
    credit,
    regularTax,
    currentMargin,
    regularMargin,
    delta: currentTax - regularTax,
    recommendation: regularMargin > currentMargin ? "Regime regular em análise" : "Simples dentro do DAS",
  };
}

export function transitionYears(input) {
  const rates = [1.0, 8.4, 17.8, 27.2, 50, 75, 90, 100];
  return rates.map((transitionShare, index) => {
    const year = 2026 + index;
    const base = calculateScenario(input);
    const blendedTax = base.currentTax * (1 - transitionShare / 100) + base.regularTax * transitionShare / 100;
    return { year, transitionShare, blendedTax, cash: Number(input.revenue) - Number(input.purchases) - Number(input.payroll) - Number(input.fixedCosts || 0) - blendedTax };
  });
}

export function classifyAbc(rows, valueKey = "value") {
  const ordered = [...rows].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
  const total = ordered.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0) || 1;
  let running = 0;
  return ordered.map((row, index) => {
    running += Number(row[valueKey] || 0);
    const accumulated = running / total * 100;
    return {
      ...row,
      rank: index + 1,
      share: Number(row[valueKey] || 0) / total * 100,
      accumulated,
      curve: accumulated <= 80 ? "A" : accumulated <= 95 ? "B" : "C",
    };
  });
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return [columns.join(";"), ...rows.map((row) => columns.map((key) => csvEscape(row[key])).join(";"))].join("\n");
}
