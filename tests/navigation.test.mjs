import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("navegação não força a visão executiva quando o tenant ainda está vazio", async () => {
  const source = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(source, /!state\.activeProject\s*&&\s*state\.activeView\s*!==\s*['"]dashboard['"]/);
  assert.match(source, /function renderDiagnosticos\(\)\s*{\s*if \(!state\.activeProject\)/);
  assert.match(source, /function renderRelatorios\(\)\s*{\s*if \(!state\.activeProject\)/);
  assert.match(source, /Nenhum diagnóstico cadastrado/);
  assert.match(source, /Nenhum relatório disponível/);
  assert.match(source, /Organizações e projetos/);
  assert.match(source, /Cadastre a organização e o projeto primeiro/);
  assert.match(source, /data-select-project/);
  assert.match(source, /function projectDialog/);
  assert.match(source, /id="projectForm"/);
  assert.match(source, /state\.activeView=diagnosisReturnView/);
  assert.match(page, /app\.js\?v=[^"']+/);
  assert.match(page, /styles\.css\?v=[^"']+/);
});
