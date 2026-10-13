import { calculateScenario, classifyAbc, decimal, money, qualityStatus, scoreQuality, toCsv, transitionYears } from "./core.mjs";

const STORAGE_KEY = "diagnostico360:v1";
const navItems = [
  ["dashboard", "⌂", "Visão executiva"],
  ["diagnosticos", "◫", "Diagnósticos"],
  ["importacao", "⇧", "Dados e importação"],
  ["cenarios", "⌁", "Cenários 2026–2033"],
  ["achados", "◇", "Achados e pendências"],
  ["plano", "✓", "Plano de ação"],
  ["relatorios", "▤", "Relatórios"],
  ["governanca", "⚙", "Motor e governança"],
];

const seed = {
  activeView: "dashboard",
  activeOrg: "org-acme",
  activeProject: "proj-2026",
  organizations: [
    { id: "org-acme", name: "ACME Autopeças Ltda.", cnpj: "12.345.678/0001-90", regime: "Simples Nacional", city: "Rondonópolis/MT", sector: "Autopeças" },
    { id: "org-vita", name: "Clínica Vita Saúde Ltda.", cnpj: "28.445.198/0001-34", regime: "Simples Nacional", city: "Cuiabá/MT", sector: "Saúde" },
  ],
  projects: [
    { id: "proj-2026", orgId: "org-acme", name: "Transição tributária 2026", period: "01/2025–12/2025", status: "Em análise", scope: "Fiscal, tributário, financeiro e operacional", package: "SN-AUTOPECAS-1.2" },
    { id: "proj-vita", orgId: "org-vita", name: "Diagnóstico inicial", period: "01/2025–12/2025", status: "Coleta", scope: "Simples e prontidão", package: "SN-SERVICOS-1.0" },
  ],
  quality: { coverage: 91, reconciliation: 86, integrity: 94, validated: 78 },
  scenario: { revenue: 4800000, purchases: 2650000, payroll: 570000, fixedCosts: 340000, currentRate: 11.2, regularRate: 28.1, eligibleCredit: 73 },
  documents: [
    { id: "doc-1", name: "NFe_saidas_2025.zip", type: "XML/ZIP", size: "86,4 MB", status: "Processado", records: 3842, integrity: "sha256:d27a…82c1", at: "12 out 2026, 15:42" },
    { id: "doc-2", name: "PGDAS_2025.pdf", type: "PDF", size: "4,8 MB", status: "Processado", records: 12, integrity: "sha256:91af…11b4", at: "12 out 2026, 16:05" },
    { id: "doc-3", name: "contas_receber.csv", type: "CSV", size: "1,2 MB", status: "Com alertas", records: 1258, integrity: "sha256:35ac…9bb3", at: "13 out 2026, 09:17" },
  ],
  findings: [
    { id: "ACH-001", area: "Fiscal", title: "Receita monofásica sem segregação no PGDAS-D", impact: 184300, priority: "Crítica", confidence: 96, status: "Confirmado", evidence: "312 itens de NFe conciliados com PGDAS-D", rule: "LC 123/2006, art. 18; Res. CGSN 140/2018", cause: "Cadastro de natureza da receita sem tratamento monofásico", condition: "Permanece válida se NCM e legislação específica forem confirmados por competência." },
    { id: "ACH-002", area: "Cadastro", title: "NCM divergente entre cadastro e XML", impact: 48700, priority: "Alta", confidence: 88, status: "Revisão", evidence: "47 SKUs em 193 documentos", rule: "NT 2025.002 RTC; tabela NCM vigente", cause: "Cadastro mestre desatualizado", condition: "O impacto muda caso a finalidade ou composição do produto seja distinta." },
    { id: "ACH-003", area: "Créditos", title: "Crédito potencial de CBS na cadeia", impact: 126800, priority: "Alta", confidence: 74, status: "Condicional", evidence: "Compras elegíveis estimadas em R$ 1,9 mi", rule: "LC 214/2025 — não cumulatividade", cause: "Fornecedores com documentação parcial", condition: "Depende de documento idôneo, extinção do débito e ausência de vedação." },
    { id: "ACH-004", area: "Financeiro", title: "Descasamento entre PMR e PMP", impact: 93500, priority: "Média", confidence: 92, status: "Confirmado", evidence: "PMR 47 dias; PMP 31 dias", rule: "Metodologia gerencial D360 v1.4", cause: "Prazo comercial de clientes superior ao prazo negociado com fornecedores", condition: "Considera custo de capital de 1,4% a.m. e volume atual." },
    { id: "ACH-005", area: "Comercial", title: "Margem negativa em 18 SKUs após transição", impact: 211400, priority: "Crítica", confidence: 83, status: "Condicional", evidence: "Mix e preço médio dos últimos 12 meses", rule: "Motor de precificação D360 v2.1", cause: "Baixo crédito elegível e preço sem cláusula de recomposição", condition: "Sensível à alíquota de referência e possibilidade de repasse." },
    { id: "ACH-006", area: "Documentos", title: "XML cancelado incluído na base financeira", impact: 12780, priority: "Média", confidence: 100, status: "Confirmado", evidence: "Chave 5125…9012 e evento de cancelamento", rule: "Ajuste SINIEF e leiaute NF-e", cause: "Integração ERP não consumiu evento", condition: "Correção documental obrigatória antes do fechamento." },
  ],
  actions: [
    { id: "ACT-01", title: "Validar NCM dos 47 SKUs divergentes", finding: "ACH-002", owner: "Marina", due: "18/10/2026", horizon: "30 dias", status: "Em andamento", priority: "Alta" },
    { id: "ACT-02", title: "Retificar segregação do PGDAS-D", finding: "ACH-001", owner: "Rafael", due: "25/10/2026", horizon: "30 dias", status: "A fazer", priority: "Crítica" },
    { id: "ACT-03", title: "Renegociar prazo com fornecedores classe A", finding: "ACH-004", owner: "Carlos", due: "15/11/2026", horizon: "60 dias", status: "Em andamento", priority: "Média" },
    { id: "ACT-04", title: "Implantar tabela de preço por cenário", finding: "ACH-005", owner: "Bianca", due: "10/12/2026", horizon: "90 dias", status: "A fazer", priority: "Alta" },
    { id: "ACT-05", title: "Excluir XML cancelado da conciliação", finding: "ACH-006", owner: "João", due: "14/10/2026", horizon: "30 dias", status: "Concluído", priority: "Média" },
  ],
  rules: [
    { id: "REG-SN-018", theme: "Simples Nacional", title: "Segregação de receita monofásica", source: "LC 123/2006, art. 18; Res. CGSN 140/2018", version: "3.2", effective: "01/01/2026", status: "Homologada" },
    { id: "REG-CBS-041", theme: "IBS/CBS", title: "Opção pelo regime regular", source: "LC 214/2025, arts. 41 e 47", version: "2.0", effective: "01/01/2027", status: "Homologada" },
    { id: "REG-XML-RTC", theme: "Documentos", title: "Grupos e validações IBS/CBS", source: "NT 2025.002 RTC", version: "1.31", effective: "05/10/2026", status: "Em revisão" },
    { id: "MET-QUAL-001", theme: "Qualidade", title: "Nota de confiabilidade", source: "Metodologia Diagnóstico 360", version: "1.4", effective: "01/08/2026", status: "Homologada" },
  ],
  coverage: [
    ["Cadastro e enquadramento", "Homologado", 100], ["Importação e conciliação", "Homologado", 94], ["Fiscal atual", "Homologado", 91],
    ["IBS e CBS", "Parcial", 82], ["Simples Nacional", "Homologado", 96], ["Créditos", "Parcial", 78],
    ["Estoque", "Parcial", 73], ["Precificação", "Homologado", 89], ["Ciclo financeiro", "Homologado", 93],
    ["Split payment", "Parcial", 68], ["Contábil", "Homologado", 86], ["Contratos", "Revisão especializada", 61],
  ],
  clients: [
    { name: "Oficina Horizonte", value: 724000, margin: 28.4, evolution: 12 }, { name: "Auto Center Brasil", value: 581000, margin: 24.8, evolution: 4 },
    { name: "Frota Sul", value: 438000, margin: 19.3, evolution: -7 }, { name: "Mecânica Prado", value: 321000, margin: 31.2, evolution: 16 },
    { name: "Varejo pulverizado", value: 1874000, margin: 34.1, evolution: 8 },
  ],
  suppliers: [
    { name: "Distribuidora Nacional", value: 812000, compliance: 96 }, { name: "Peças Prime", value: 593000, compliance: 82 },
    { name: "Importadora Sul", value: 471000, compliance: 64 }, { name: "Fábrica Centro-Oeste", value: 389000, compliance: 91 },
  ],
  audit: [
    { at: "13/10/2026 10:18", user: "Alessandra Corrêa", event: "Premissas do cenário v4 aprovadas", version: "MOTOR-2.4.1" },
    { at: "13/10/2026 09:42", user: "Rafael Mendes", event: "Conciliação financeira reprocessada", version: "EXEC-007" },
    { at: "12/10/2026 16:05", user: "Sistema", event: "PGDAS_2025.pdf importado", version: "PARSER-1.8.0" },
  ],
};

let state = loadState();
let findingFilter = "Todos";
const main = document.querySelector("#main");
const dialog = document.querySelector("#dialog");
const fileInput = document.querySelector("#fileInput");

function loadState() {
  try { return { ...structuredClone(seed), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return structuredClone(seed); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function activeOrg() { return state.organizations.find((item) => item.id === state.activeOrg) || state.organizations[0]; }
function activeProject() { return state.projects.find((item) => item.id === state.activeProject) || state.projects[0]; }
function score() { return scoreQuality(state.quality); }
function pendingCount() { return state.findings.filter((item) => item.status !== "Confirmado").length + state.actions.filter((item) => item.status !== "Concluído").length; }
function statusTone(label) {
  if (/valid|homolog|confirm|conclu|processado/i.test(label)) return "success";
  if (/insuf|crítica|bloque|erro/i.test(label)) return "danger";
  if (/parcial|revis|alerta|condicional|andamento/i.test(label)) return "warning";
  return "info";
}
function status(label) { return `<span class="status ${statusTone(label)}">${label}</span>`; }
function percent(value) { return `${decimal.format(value)}%`; }
function pageHead(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
function renderNav() {
  document.querySelector("#nav").innerHTML = navItems.map(([id, icon, label]) => `<button class="nav-item ${state.activeView === id ? "active" : ""}" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span>${id === "achados" ? `<span class="nav-badge">${pendingCount()}</span>` : ""}</button>`).join("");
}
function renderContext() {
  const orgSelect = document.querySelector("#orgSelect");
  orgSelect.innerHTML = state.organizations.map((org) => `<option value="${org.id}" ${org.id === state.activeOrg ? "selected" : ""}>${org.name}</option>`).join("");
  const projects = state.projects.filter((item) => item.orgId === state.activeOrg);
  if (!projects.some((item) => item.id === state.activeProject)) state.activeProject = projects[0]?.id;
  document.querySelector("#projectSelect").innerHTML = projects.map((project) => `<option value="${project.id}" ${project.id === state.activeProject ? "selected" : ""}>${project.name}</option>`).join("");
  document.querySelector("#notificationCount").textContent = pendingCount();
  document.querySelector("#coverageMini").textContent = `${score()}%`;
  document.querySelector("#coverageBar").style.width = `${score()}%`;
}

function renderDashboard() {
  const calc = calculateScenario(state.scenario);
  const years = transitionYears(state.scenario);
  const maxTax = Math.max(...years.map((x) => x.blendedTax));
  const impacts = [...state.findings].sort((a,b) => b.impact-a.impact).slice(0,4);
  return `${pageHead("Visão executiva", `Bom dia, ${document.querySelector(".profile strong").textContent.split(" ")[0]}.`, "Veja o que afeta o resultado, o que pode acontecer e o que precisa ser feito antes.", `<button class="ghost" data-view="relatorios">Ver relatório</button><button class="button gold" data-action="new-diagnosis">Novo diagnóstico</button>`)}
    <div class="notice"><strong>Resultado condicional.</strong> O cenário possui boa cobertura, mas 3 exceções materiais ainda exigem evidência ou revisão especializada.</div>
    <section class="grid metrics" aria-label="Indicadores principais">
      ${metric("Oportunidades mapeadas", money.format(state.findings.reduce((s,x)=>s+x.impact,0)), "+12,4% desde a última execução", "↗")}
      ${metric("Economia potencial", money.format(Math.max(0, calc.delta * 12)), "Estimativa — não realizada", "◎")}
      ${metric("Ações em andamento", state.actions.filter((x)=>x.status === "Em andamento").length, `${state.actions.filter((x)=>x.status !== "Concluído").length} ações abertas`, "✓")}
      ${metric("Confiabilidade dos dados", `${score()}%`, qualityStatus(score()).label, "◉")}
    </section>
    <section class="grid two-col">
      <article class="card"><div class="card-head"><div><h3>Projeção da carga tributária</h3><p>Transição 2026–2033 com premissas editáveis</p></div><button class="ghost" data-view="cenarios">Simular</button></div>
        <div class="chart">${years.map((row)=>`<div class="bar-group"><i class="bar" style="height:${Math.max(8, calc.currentTax/maxTax*100)}%" title="Atual: ${money.format(calc.currentTax)}"></i><i class="bar alt" style="height:${Math.max(8,row.blendedTax/maxTax*100)}%" title="Projetado: ${money.format(row.blendedTax)}"></i><label>${row.year}</label></div>`).join("")}</div>
        <div class="legend"><span><i></i>Regime atual</span><span><i class="alt"></i>Cenário projetado</span></div>
      </article>
      <article class="card"><div class="card-head"><div><h3>Qualidade do diagnóstico</h3><p>Empresa, período e módulos ativos</p></div>${status(qualityStatus(score()).label)}</div>
        <div class="quality-ring" style="--score:${score()}"><span>${score()}<small>de 100</small></span></div>
        <div class="quality-lines">${Object.entries({coverage:"Cobertura documental",reconciliation:"Conciliação",integrity:"Integridade dos campos",validated:"Itens validados"}).map(([key,label])=>`<div class="quality-line"><span>${label}</span><strong>${state.quality[key]}%</strong><div><i style="width:${state.quality[key]}%"></i></div></div>`).join("")}</div>
      </article>
    </section>
    <section class="grid two-col" style="margin-top:18px">
      <article class="card"><div class="card-head"><div><h3>Impactos prioritários</h3><p>Ordenados por valor e materialidade</p></div><button class="ghost" data-view="achados">Ver todos</button></div>
        <ul class="impact-list">${impacts.map((item)=>`<li><span class="impact-icon">${item.area.slice(0,1)}</span><span><strong>${item.title}</strong><small>${item.area} · confiança ${item.confidence}%</small></span><span class="impact-value">${money.format(item.impact)}</span></li>`).join("")}</ul>
      </article>
      <article class="card"><div class="card-head"><div><h3>Próximas decisões</h3><p>Prazos que merecem atenção</p></div></div>
        <ul class="timeline">${state.actions.filter((x)=>x.status!=="Concluído").slice(0,4).map((item)=>`<li><span class="impact-icon">${item.due.slice(0,2)}</span><span><strong>${item.title}</strong><small>${item.owner} · ${item.horizon}</small></span></li>`).join("")}</ul>
      </article>
    </section>`;
}
function metric(label, value, delta, icon) { return `<article class="card metric"><div class="metric-label"><span>${label}</span><span>${icon}</span></div><strong>${value}</strong><span class="delta">${delta}</span></article>`; }

function renderDiagnosticos() {
  const q = qualityStatus(score());
  const stages = [["Cadastro",true],["Documentos",true],["Conciliação",true],["Classificação",true],["Cenários",false],["Liberação",false]];
  return `${pageHead("Jornada do diagnóstico", "Diagnósticos", "Cada execução preserva dados, regras, premissas e resultados para reprodução e auditoria.", `<button class="button gold" data-action="new-diagnosis">Novo diagnóstico</button>`)}
    <section class="card"><div class="card-head"><div><h3>${activeProject().name}</h3><p>${activeOrg().name} · ${activeProject().period} · pacote ${activeProject().package}</p></div>${status(activeProject().status)}</div>
      <div class="workflow">${stages.map(([label,done],i)=>`<div class="workflow-step ${done?"done":i===4?"current":""}"><b>${done?"✓":i+1}</b><strong>${label}</strong><small>${done?"Concluído":i===4?"Em análise":"Aguardando"}</small></div>`).join("")}</div>
    </section>
    <section class="grid two-col" style="margin-top:18px">
      <article class="card"><div class="card-head"><div><h3>Contrato da execução</h3><p>Identificação e governança obrigatórias</p></div><span class="pill">EXEC-007</span></div>
        <div class="table-wrap"><table><tbody>
          <tr><th>Organização</th><td>${activeOrg().name}<br><small>${activeOrg().cnpj} · ${activeOrg().city}</small></td></tr>
          <tr><th>Escopo</th><td>${activeProject().scope}</td></tr><tr><th>Competência</th><td>${activeProject().period}</td></tr>
          <tr><th>Motor</th><td>MOTOR-2.4.1 · regras vigentes na data de corte</td></tr><tr><th>Qualidade</th><td>${status(q.label)} ${score()}% de confiança</td></tr>
          <tr><th>Decisão</th><td>Liberação condicionada à resolução de 3 exceções materiais</td></tr>
        </tbody></table></div>
      </article>
      <article class="card"><div class="card-head"><div><h3>Dependências e bloqueios</h3><p>O sistema informa exatamente o que falta</p></div></div>
        <ul class="check-list"><li class="notice">⚠ Confirmar documentação de 7 fornecedores para crédito CBS.</li><li class="notice">⚠ Validar finalidade e NCM de 47 SKUs divergentes.</li><li class="notice">⚠ Aceitar premissa de repasse parcial nos contratos B2B.</li></ul>
        <button class="button full" data-view="achados">Tratar exceções</button>
      </article>
    </section>`;
}

function renderImportacao() {
  return `${pageHead("Base auditável", "Dados e importação", "Preserve o original, registre a origem e acompanhe integridade, cobertura e erros por arquivo.", `<button class="ghost" data-action="export-data">Exportar inventário</button><button class="button gold" data-action="pick-files">Importar arquivos</button>`)}
    <section class="dropzone" id="dropzone"><div><div class="dropzone-icon">⇧</div><h2>Solte seus arquivos aqui</h2><p>XML, ZIP, CSV, XLSX, PDF e TXT. XML e CSV são lidos diretamente; demais formatos entram na fila de processamento do ambiente.</p><button class="button" data-action="pick-files">Selecionar arquivos</button></div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h3>Arquivos recebidos</h3><p>${state.documents.reduce((sum,x)=>sum+(x.records||0),0).toLocaleString("pt-BR")} registros identificados</p></div>${status("Cobertura 91%")}</div>
      <div class="grid">${state.documents.map((file)=>`<div class="file-row"><span class="file-icon">${file.type.split("/")[0]}</span><span><strong>${file.name}</strong><small>${file.size} · ${file.records || 0} registros · ${file.at}</small></span>${status(file.status)}<button class="icon-button" data-file="${file.id}" aria-label="Detalhes do arquivo">›</button></div>`).join("")}</div>
    </section>`;
}

function renderCenarios() {
  const calc = calculateScenario(state.scenario);
  const years = transitionYears(state.scenario);
  return `${pageHead("Previsibilidade", "Cenários 2026–2033", "Compare alternativas equivalentes, identifique pontos de virada e veja quais premissas sustentam a recomendação.", `<button class="ghost" data-action="reset-scenario">Restaurar premissas</button><button class="button gold" data-action="save-scenario">Salvar versão</button>`)}
    <div class="notice"><strong>Premissas transparentes:</strong> alíquotas de referência são editáveis e precisam ser classificadas como oficiais ou estimadas. Este cenário usa uma estimativa para demonstração.</div>
    <section class="grid two-col">
      <article class="card"><div class="card-head"><div><h3>Premissas do cenário</h3><p>Mesmo período, volume, mix e preços</p></div><span class="pill">CEN-v4</span></div>
        <form id="scenarioForm" class="form-grid">
          ${scenarioField("revenue","Receita anual (R$)",state.scenario.revenue)}${scenarioField("purchases","Compras elegíveis (R$)",state.scenario.purchases)}
          ${scenarioField("payroll","Folha anual (R$)",state.scenario.payroll)}${scenarioField("fixedCosts","Custos fixos (R$)",state.scenario.fixedCosts)}
          ${scenarioField("currentRate","Alíquota efetiva atual (%)",state.scenario.currentRate,0.1)}${scenarioField("regularRate","IBS + CBS estimados (%)",state.scenario.regularRate,0.1)}
          ${scenarioField("eligibleCredit","Crédito elegível sobre compras (%)",state.scenario.eligibleCredit,1)}
          <label class="field"><span>Natureza da alíquota</span><select><option>Estimativa identificada</option><option>Oficial publicada</option></select></label>
        </form>
      </article>
      <article class="card scenario-output"><div class="card-head"><div><h3>Leitura executiva</h3><p>Resultado calculado com memória reproduzível</p></div>${status(calc.delta > 0 ? "Oportunidade" : "Atenção")}</div>
        <small>Diferença mensal estimada</small><div class="big-result">${money.format(calc.delta)}</div><p><strong>${calc.recommendation}</strong></p>
        <div class="result-grid"><div><small>DAS atual</small><strong>${money.format(calc.currentTax)}</strong></div><div><small>Débito IBS/CBS</small><strong>${money.format(calc.debit)}</strong></div><div><small>Créditos</small><strong>${money.format(calc.credit)}</strong></div><div><small>Saldo regular</small><strong>${money.format(calc.regularTax)}</strong></div><div><small>Margem atual</small><strong>${money.format(calc.currentMargin)}</strong></div><div><small>Margem regular</small><strong>${money.format(calc.regularMargin)}</strong></div></div>
        <p><small>Condição de validade: manutenção do mix, preços e elegibilidade documental dos créditos. Não constitui garantia de resultado.</small></p>
      </article>
    </section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h3>Linha do tempo da transição</h3><p>Carga combinada e caixa após tributos</p></div></div><div class="table-wrap"><table><thead><tr><th>Ano</th><th>Participação do novo regime</th><th>Carga estimada</th><th>Caixa após custos</th><th>Variação vs. atual</th></tr></thead><tbody>${years.map((x)=>`<tr><td><strong>${x.year}</strong></td><td>${percent(x.transitionShare)}</td><td>${money.format(x.blendedTax)}</td><td>${money.format(x.cash)}</td><td class="${x.blendedTax<calc.currentTax?"delta":""}">${money.format(calc.currentTax-x.blendedTax)}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function scenarioField(name,label,value,step=1) { return `<label class="field"><span>${label}</span><input name="${name}" type="number" step="${step}" min="0" value="${value}"></label>`; }

function renderAchados() {
  const filters = ["Todos","Crítica","Alta","Condicional","Revisão"];
  const rows = state.findings.filter((item)=>findingFilter==="Todos" || item.priority===findingFilter || item.status===findingFilter);
  return `${pageHead("Decisão rastreável", "Achados e pendências", "Cada achado conecta causa, evidência, fundamento, impacto, condição de validade e próxima ação.", `<button class="ghost" data-action="export-findings">Exportar CSV</button><button class="button gold" data-action="new-finding">Novo achado</button>`)}
    <div class="filters">${filters.map((filter)=>`<button class="filter ${filter===findingFilter?"active":""}" data-filter="${filter}">${filter}</button>`).join("")}</div>
    <section class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Área e achado</th><th>Impacto anual</th><th>Prioridade</th><th>Confiança</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((item)=>`<tr><td><span class="pill">${item.id}</span></td><td><strong>${item.title}</strong><br><small>${item.area}</small></td><td><strong>${money.format(item.impact)}</strong></td><td>${status(item.priority)}</td><td>${item.confidence}%</td><td>${status(item.status)}</td><td><button class="icon-button" data-finding="${item.id}" aria-label="Abrir achado">›</button></td></tr>`).join("")}</tbody></table></div>${!rows.length?`<div class="empty">Nenhum achado neste filtro.</div>`:""}</section>`;
}

function renderPlano() {
  const statuses = ["A fazer","Em andamento","Em validação","Concluído"];
  return `${pageHead("Da decisão à execução", "Plano de ação", "Priorize por impacto e esforço, registre evidências e compare o indicador antes e depois.", `<button class="ghost" data-action="export-actions">Exportar plano</button><button class="button gold" data-action="new-action">Adicionar ação</button>`)}
    <div class="filters"><span class="filter active">Todos os horizontes</span><span class="filter">30 dias</span><span class="filter">60 dias</span><span class="filter">90 dias</span><span class="filter">Longo prazo</span></div>
    <section class="kanban">${statuses.map((column)=>`<div class="kanban-col"><div class="kanban-head"><span>${column}</span><span>${state.actions.filter((x)=>x.status===column).length}</span></div>${state.actions.filter((x)=>x.status===column).map((task)=>`<article class="task"><span class="status ${statusTone(task.priority)}">${task.priority}</span><p><strong>${task.title}</strong></p><div class="task-meta"><span>${task.finding}</span><span>${task.horizon}</span></div><div class="task-meta" style="margin-top:8px"><span>${task.owner}</span><span>${task.due}</span></div><button class="ghost full" style="color:var(--ink);border-color:var(--line);margin-top:10px" data-advance="${task.id}">${column==="Concluído"?"Ver evidência":"Avançar etapa"}</button></article>`).join("")}</div>`).join("")}</section>`;
}

function renderRelatorios() {
  const calc = calculateScenario(state.scenario);
  const impacts = [...state.findings].sort((a,b)=>b.impact-a.impact).slice(0,5);
  return `${pageHead("Entrega integrada", "Relatório executivo", "A visão do empresário e a memória técnica são produzidas pela mesma versão do motor.", `<button class="ghost" data-action="export-json">Exportar dados</button><button class="button gold" data-action="print-report">Imprimir / salvar PDF</button>`)}
    <article class="card" id="report"><div class="report-cover"><div class="eyebrow">Diagnóstico 360 · Relatório executivo</div><h2>${activeOrg().name}</h2><p>${activeProject().period} · EXEC-007 · MOTOR-2.4.1</p><p>PREVISIBILIDADE PARA DECIDIR ANTES QUE O IMPACTO ACONTEÇA.</p></div>
      <section class="report-section"><div class="card-head"><div><h2>Situação atual</h2><p>Leitura executiva do diagnóstico</p></div>${status(qualityStatus(score()).label)}</div><p>Foram processados ${state.documents.reduce((s,x)=>s+(x.records||0),0).toLocaleString("pt-BR")} registros com ${score()}% de confiabilidade. A conclusão permanece condicional até resolver as exceções materiais de classificação e documentação de créditos.</p></section>
      <section class="report-section"><h2>Impactos prioritários</h2><div class="table-wrap"><table><thead><tr><th>Decisão</th><th>Impacto</th><th>Confiança</th><th>Status</th></tr></thead><tbody>${impacts.map(x=>`<tr><td><strong>${x.title}</strong><br><small>${x.condition}</small></td><td>${money.format(x.impact)}</td><td>${x.confidence}%</td><td>${status(x.status)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="report-section"><h2>Cenário comparável</h2><div class="grid three-col" style="margin-top:15px">${metric("Carga atual",money.format(calc.currentTax),"por mês","A")}${metric("Carga regular",money.format(calc.regularTax),"por mês","B")}${metric("Ponto de decisão",money.format(Math.abs(calc.delta)),calc.delta>0?"vantagem estimada":"custo adicional","∆")}</div></section>
      <section class="report-section"><h2>Próximos passos</h2><ol>${state.actions.filter(x=>x.status!=="Concluído").map(x=>`<li><strong>${x.title}</strong> — ${x.owner}, até ${x.due}.</li>`).join("")}</ol></section>
      <section class="report-section"><h2>Limites e rastreabilidade</h2><p>Valores projetados não são garantia de resultado. Cada conclusão está vinculada a premissas, evidências, fonte normativa, vigência e versão do motor. A versão técnica inclui memória de cálculo, dossiê de evidências, arquivos de origem e log de aprovações.</p></section>
    </article>`;
}

function renderGovernanca() {
  return `${pageHead("Método versionado", "Motor legal e governança", "Regras nunca sobrescrevem o passado: mudanças criam versão, impacto e fila de reprocessamento.", `<button class="ghost" data-action="export-audit">Exportar log</button><button class="button gold" data-action="new-rule">Nova regra</button>`)}
    <section class="grid two-col"><article class="card"><div class="card-head"><div><h3>Matriz de cobertura</h3><p>Somente pacotes homologados liberam conclusão automática</p></div></div><div class="grid">${state.coverage.map(([name,label,value])=>`<div class="rule-card"><div><strong>${name}</strong><div class="progress" style="background:#eceae1;margin:8px 0 0"><i style="width:${value}%"></i></div></div><div>${status(label)}<small style="display:block;text-align:right;margin-top:5px">${value}%</small></div></div>`).join("")}</div></article>
      <article class="card"><div class="card-head"><div><h3>Regras e fontes</h3><p>Identificador, vigência, versão e revisão</p></div></div><div class="grid">${state.rules.map(rule=>`<div class="rule-card"><div><span class="eyebrow">${rule.id} · ${rule.theme}</span><strong>${rule.title}</strong><p>${rule.source}</p><div class="rule-meta"><span class="pill">v${rule.version}</span><span class="pill">desde ${rule.effective}</span></div></div>${status(rule.status)}</div>`).join("")}</div></article></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h3>Trilha de auditoria</h3><p>Eventos relevantes, sem dados pessoais desnecessários</p></div></div><div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Usuário</th><th>Evento</th><th>Versão</th></tr></thead><tbody>${state.audit.map(row=>`<tr><td>${row.at}</td><td>${row.user}</td><td>${row.event}</td><td><span class="pill">${row.version}</span></td></tr>`).join("")}</tbody></table></div></section>`;
}

function render() {
  renderNav(); renderContext();
  const views = { dashboard:renderDashboard, diagnosticos:renderDiagnosticos, importacao:renderImportacao, cenarios:renderCenarios, achados:renderAchados, plano:renderPlano, relatorios:renderRelatorios, governanca:renderGovernanca };
  main.innerHTML = (views[state.activeView] || renderDashboard)();
  main.focus({ preventScroll: true });
  if (state.activeView === "importacao") bindDropzone();
}

function toast(message) {
  const item = document.createElement("div"); item.className = "toast"; item.textContent = message;
  document.querySelector("#toasts").append(item); setTimeout(()=>item.remove(), 3500);
}
function openDialog(content) { document.querySelector("#dialogContent").innerHTML = `<div class="dialog-body">${content}</div>`; dialog.showModal(); }
function closeDialog() { dialog.close(); }
function detailFinding(id) {
  const item = state.findings.find((x)=>x.id===id); if (!item) return;
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">${item.id} · ${item.area}</div><h2>${item.title}</h2></div><button class="close" data-action="close-dialog">×</button></div>
    <div class="grid"><div>${status(item.status)} ${status(item.priority)} <span class="pill">confiança ${item.confidence}%</span></div><div><strong>Impacto anual estimado</strong><div class="big-result" style="color:var(--gold)">${money.format(item.impact)}</div></div>
    <div><strong>Causa</strong><p>${item.cause}</p></div><div><strong>Evidência</strong><p>${item.evidence}</p></div><div><strong>Fundamento</strong><p>${item.rule}</p></div><div class="notice"><strong>O que pode mudar a conclusão:</strong> ${item.condition}</div></div>`);
}
function formDialog(kind) {
  const isAction = kind === "action";
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Novo registro</div><h2>${isAction?"Adicionar ação":"Registrar achado"}</h2></div><button class="close" data-action="close-dialog">×</button></div>
    <form id="quickForm" data-kind="${kind}" class="form-grid"><label class="field" style="grid-column:1/-1"><span>Título</span><input name="title" required></label>
    ${isAction?`<label class="field"><span>Responsável</span><input name="owner" required></label><label class="field"><span>Prazo</span><input name="due" type="date" required></label><label class="field"><span>Achado vinculado</span><select name="finding">${state.findings.map(x=>`<option>${x.id}</option>`).join("")}</select></label><label class="field"><span>Horizonte</span><select name="horizon"><option>30 dias</option><option>60 dias</option><option>90 dias</option><option>Longo prazo</option></select></label>`:`<label class="field"><span>Área</span><input name="area" required></label><label class="field"><span>Impacto estimado</span><input name="impact" type="number" min="0" required></label><label class="field" style="grid-column:1/-1"><span>Evidência</span><textarea name="evidence" required></textarea></label>`}
    <button class="button gold" style="grid-column:1/-1">Salvar registro</button></form>`);
}
function newDiagnosisDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Onboarding orientado</div><h2>Novo diagnóstico</h2></div><button class="close" data-action="close-dialog">×</button></div><form id="diagnosisForm" class="form-grid">
    <label class="field" style="grid-column:1/-1"><span>Nome da organização</span><input name="orgName" required></label><label class="field"><span>CNPJ</span><input name="cnpj" required></label><label class="field"><span>Regime</span><select name="regime"><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></label><label class="field"><span>Nome do projeto</span><input name="projectName" value="Diagnóstico inicial" required></label><label class="field"><span>Período</span><input name="period" value="01/2026–12/2026" required></label><label class="field" style="grid-column:1/-1"><span>Objetivo do estudo</span><textarea name="scope" required>Fiscal, tributário, financeiro e operacional</textarea></label><button class="button gold" style="grid-column:1/-1">Criar diagnóstico</button></form>`);
}
function ruleDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Governança metodológica</div><h2>Nova regra</h2></div><button class="close" data-action="close-dialog">×</button></div><form id="ruleForm" class="form-grid"><label class="field"><span>Identificador</span><input name="id" required></label><label class="field"><span>Tema</span><input name="theme" required></label><label class="field" style="grid-column:1/-1"><span>Título</span><input name="title" required></label><label class="field" style="grid-column:1/-1"><span>Fonte oficial e dispositivo</span><textarea name="source" required></textarea></label><label class="field"><span>Versão</span><input name="version" required></label><label class="field"><span>Vigência</span><input name="effective" type="date" required></label><button class="button gold" style="grid-column:1/-1">Salvar para revisão</button></form>`);
}
function methodDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Metodologia e limites</div><h2>Clareza sem falsa certeza</h2></div><button class="close" data-action="close-dialog">×</button></div><p>O Diagnóstico 360 conecta dados, regras e cenários. Resultados automáticos só são liberados dentro de pacotes legais homologados e com cobertura suficiente.</p><ul><li>Estimativas são visualmente distintas de valores confirmados.</li><li>Crédito potencial não é apresentado como crédito realizado.</li><li>Exceções materiais seguem para revisão especializada.</li><li>Cada número retorna à evidência, fórmula, regra e versão.</li><li>O sistema não substitui parecer jurídico ou responsabilidade profissional.</li></ul>`);
}
function profileDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Perfil ativo</div><h2>Alessandra Corrêa</h2></div><button class="close" data-action="close-dialog">×</button></div><p>Administradora AC · acesso a metodologia, usuários, normas, regras, modelos e liberação de relatórios.</p><div class="notice">Demonstração local: autenticação, MFA e isolamento no servidor serão configurados na etapa de infraestrutura do VPS.</div>`);
}
function download(name, content, type="text/plain;charset=utf-8") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportRows(kind) {
  if (kind === "findings") download("achados-diagnostico-360.csv", toCsv(state.findings), "text/csv;charset=utf-8");
  if (kind === "actions") download("plano-de-acao-diagnostico-360.csv", toCsv(state.actions), "text/csv;charset=utf-8");
  if (kind === "documents") download("inventario-documentos.csv", toCsv(state.documents), "text/csv;charset=utf-8");
  if (kind === "audit") download("trilha-auditoria.csv", toCsv(state.audit), "text/csv;charset=utf-8");
}
async function handleFiles(files) {
  for (const file of files) {
    let records = 0, fileStatus = "Na fila";
    try {
      if (/\.xml$/i.test(file.name)) {
        const xml = new DOMParser().parseFromString(await file.text(), "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("XML malformado");
        records = xml.querySelectorAll("det, infNFe, CompNfse, infCte").length || 1; fileStatus = "Processado";
      } else if (/\.csv$/i.test(file.name)) {
        records = Math.max(0, (await file.text()).split(/\r?\n/).filter(Boolean).length - 1); fileStatus = "Processado";
      } else if (/\.(pdf|zip|xlsx|txt)$/i.test(file.name)) { records = 0; fileStatus = "Na fila"; }
      else { fileStatus = "Formato não suportado"; }
    } catch { fileStatus = "Erro de leitura"; }
    state.documents.unshift({ id: crypto.randomUUID(), name:file.name, type:file.name.split(".").pop().toUpperCase(), size:`${(file.size/1024/1024).toFixed(2)} MB`, status:fileStatus, records, integrity:`local:${file.lastModified.toString(16)}`, at:new Date().toLocaleString("pt-BR") });
  }
  state.quality.coverage = Math.min(100, state.quality.coverage + files.length);
  saveState(); render(); toast(`${files.length} arquivo(s) registrado(s) com rastreabilidade local.`);
}
function bindDropzone() {
  const zone = document.querySelector("#dropzone"); if (!zone) return;
  ["dragenter","dragover"].forEach(name=>zone.addEventListener(name,(event)=>{event.preventDefault();zone.classList.add("drag");}));
  ["dragleave","drop"].forEach(name=>zone.addEventListener(name,(event)=>{event.preventDefault();zone.classList.remove("drag");}));
  zone.addEventListener("drop",(event)=>handleFiles([...event.dataTransfer.files]));
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button,[data-view]"); if (!target) return;
  if (target.dataset.view) { state.activeView=target.dataset.view; saveState(); render(); document.querySelector("#sidebar").classList.remove("open"); return; }
  if (target.dataset.filter) { findingFilter=target.dataset.filter; render(); return; }
  if (target.dataset.finding) { detailFinding(target.dataset.finding); return; }
  if (target.dataset.file) { const file=state.documents.find(x=>x.id===target.dataset.file); openDialog(`<div class="dialog-head"><h2>${file.name}</h2><button class="close" data-action="close-dialog">×</button></div><p>${status(file.status)}</p><p><strong>Integridade:</strong> ${file.integrity}</p><p><strong>Registros:</strong> ${file.records}</p><p><strong>Recebido:</strong> ${file.at}</p>`); return; }
  if (target.dataset.advance) { const item=state.actions.find(x=>x.id===target.dataset.advance); const stages=["A fazer","Em andamento","Em validação","Concluído"]; if(item.status!=="Concluído") item.status=stages[Math.min(3,stages.indexOf(item.status)+1)]; saveState(); render(); toast("Etapa atualizada e registrada na trilha local."); return; }
  const action = target.dataset.action;
  if (action === "toggle-menu") document.querySelector("#sidebar").classList.toggle("open");
  if (action === "go-pending") { state.activeView="achados"; saveState(); render(); }
  if (action === "pick-files") fileInput.click();
  if (action === "close-dialog") closeDialog();
  if (action === "open-method") methodDialog();
  if (action === "profile") profileDialog();
  if (action === "new-diagnosis") newDiagnosisDialog();
  if (action === "new-finding") formDialog("finding");
  if (action === "new-action") formDialog("action");
  if (action === "new-rule") ruleDialog();
  if (action === "export-findings") exportRows("findings");
  if (action === "export-actions") exportRows("actions");
  if (action === "export-data") exportRows("documents");
  if (action === "export-audit") exportRows("audit");
  if (action === "export-json") download("diagnostico-360-dados.json", JSON.stringify(state,null,2), "application/json");
  if (action === "print-report") window.print();
  if (action === "save-scenario") { state.audit.unshift({at:new Date().toLocaleString("pt-BR"),user:"Alessandra Corrêa",event:"Premissas do cenário salvas",version:"CEN-v5"});saveState();toast("Cenário salvo como nova versão."); }
  if (action === "reset-scenario") { state.scenario=structuredClone(seed.scenario);saveState();render();toast("Premissas restauradas."); }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#scenarioForm") && event.target.name) { state.scenario[event.target.name]=Number(event.target.value); saveState(); render(); }
});
document.addEventListener("submit", (event) => {
  event.preventDefault(); const data=Object.fromEntries(new FormData(event.target));
  if (event.target.id === "quickForm") {
    if (event.target.dataset.kind === "action") state.actions.unshift({id:`ACT-${String(state.actions.length+1).padStart(2,"0")}`,title:data.title,owner:data.owner,due:new Date(`${data.due}T12:00`).toLocaleDateString("pt-BR"),finding:data.finding,horizon:data.horizon,status:"A fazer",priority:"Média"});
    else state.findings.unshift({id:`ACH-${String(state.findings.length+1).padStart(3,"0")}`,area:data.area,title:data.title,impact:Number(data.impact),priority:"Média",confidence:50,status:"Condicional",evidence:data.evidence,rule:"Fundamento pendente",cause:"Em apuração",condition:"Depende de revisão e evidência complementar."});
  }
  if (event.target.id === "diagnosisForm") { const orgId=crypto.randomUUID(), projectId=crypto.randomUUID(); state.organizations.push({id:orgId,name:data.orgName,cnpj:data.cnpj,regime:data.regime,city:"Não informado",sector:"A classificar"});state.projects.push({id:projectId,orgId,name:data.projectName,period:data.period,status:"Coleta",scope:data.scope,package:"A HOMOLOGAR"});state.activeOrg=orgId;state.activeProject=projectId;state.activeView="diagnosticos"; }
  if (event.target.id === "ruleForm") state.rules.unshift({...data,status:"Em revisão"});
  saveState(); closeDialog(); render(); toast("Registro salvo com sucesso.");
});
document.querySelector("#orgSelect").addEventListener("change",(event)=>{state.activeOrg=event.target.value;state.activeProject=state.projects.find(x=>x.orgId===state.activeOrg)?.id;saveState();render();});
document.querySelector("#projectSelect").addEventListener("change",(event)=>{state.activeProject=event.target.value;saveState();render();});
fileInput.addEventListener("change",()=>{handleFiles([...fileInput.files]);fileInput.value="";});
dialog.addEventListener("click",(event)=>{if(event.target===dialog) closeDialog();});

render();
