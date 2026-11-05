import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("navegação não força a visão executiva quando o tenant ainda está vazio", async () => {
  const source = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /!state\.activeProject\s*&&\s*state\.activeView\s*!==\s*['"]dashboard['"]/);
  assert.match(source, /function renderDiagnosticos\(\)\s*{\s*if \(!state\.activeProject\)/);
  assert.match(source, /function renderRelatorios\(\)\s*{\s*if \(!state\.activeProject\)/);
  assert.match(source, /Nenhum diagnóstico cadastrado/);
  assert.match(source, /Nenhum relatório disponível/);
});
