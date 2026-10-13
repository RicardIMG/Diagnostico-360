import test from "node:test";
import assert from "node:assert/strict";
import { calculateScenario, classifyAbc, qualityStatus, scoreQuality, transitionYears } from "../dist/core.mjs";

test("nota de qualidade aplica os pesos metodológicos", () => {
  assert.equal(scoreQuality({ coverage: 100, reconciliation: 80, integrity: 90, validated: 70 }), 87);
  assert.equal(qualityStatus(87).label, "Adequado");
  assert.equal(qualityStatus(92).canRelease, true);
});

test("cenário separa débito, crédito e saldo regular", () => {
  const result = calculateScenario({ revenue: 100000, purchases: 40000, payroll: 10000, currentRate: 10, regularRate: 20, eligibleCredit: 75 });
  assert.equal(result.currentTax, 10000);
  assert.equal(result.debit, 20000);
  assert.equal(result.credit, 6000);
  assert.equal(result.regularTax, 14000);
  assert.equal(result.delta, -4000);
});

test("transição mantém oito competências anuais e extremos coerentes", () => {
  const input = { revenue: 100000, purchases: 40000, payroll: 10000, currentRate: 10, regularRate: 20, eligibleCredit: 75 };
  const years = transitionYears(input);
  assert.equal(years.length, 8);
  assert.equal(years[0].year, 2026);
  assert.equal(years.at(-1).year, 2033);
  assert.equal(years.at(-1).blendedTax, 14000);
});

test("curva ABC ordena e calcula participação acumulada", () => {
  const rows = classifyAbc([{ name: "B", value: 20 }, { name: "A", value: 80 }]);
  assert.equal(rows[0].name, "A");
  assert.equal(rows[0].curve, "A");
  assert.equal(Math.round(rows[1].accumulated), 100);
});
