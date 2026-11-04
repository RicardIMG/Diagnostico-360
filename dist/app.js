import { calculateScenario, classifyAbc, decimal, money, qualityStatus, scoreQuality, toCsv, transitionYears } from "./core.mjs";

const PREFERENCES_KEY = "diagnostico360:preferences:v2";
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
  activeOrg: null,
  activeProject: null,
  organizations: [],
  projects: [],
  quality: { coverage: 0, reconciliation: 0, integrity: 0, validated: 0 },
  scenario: { revenue: 0, purchases: 0, payroll: 0, fixedCosts: 0, currentRate: 0, regularRate: 0, eligibleCredit: 0 },
  documents: [],
  findings: [],
  actions: [],
  rules: [],
  coverage: [],
  clients: [],
  suppliers: [],
  audit: [],
};

let state = structuredClone(seed);
let currentUser = null;
let tenants = [];
let currentTenantId = null;
let stateVersion = 1;
let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;
let findingFilter = "Todos";
const main = document.querySelector("#main");
const dialog = document.querySelector("#dialog");
const fileInput = document.querySelector("#fileInput");

function preferences() { try { return JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {}; } catch { return {}; } }
function savePreferences() { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ tenantId: currentTenantId, orgId: state.activeOrg, projectId: state.activeProject, activeView: state.activeView })); }

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (currentTenantId) headers.set('x-tenant-id', currentTenantId);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw Object.assign(new Error(payload?.error || `Erro HTTP ${response.status}`), { status: response.status });
  return payload;
}

function projectStatePayload() {
  const { organizations, projects, documents, activeOrg, activeProject, activeView, ...data } = state;
  return data;
}

function saveState() {
  savePreferences();
  saveQueued = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushState, 450);
}

async function flushState() {
  if (saveInFlight || !state.activeProject) return;
  saveInFlight = true; saveQueued = false;
  try {
    const result = await api(`/api/projects/${state.activeProject}/state`, { method: 'PUT', body: JSON.stringify({ data: projectStatePayload(), version: stateVersion }) });
    stateVersion = result.version;
  } catch (error) {
    if (error.status === 409) toast('Outro usuário alterou este projeto. Recarregue para evitar sobrescrever dados.');
    else toast(`Falha ao salvar no servidor: ${error.message}`);
  } finally {
    saveInFlight = false;
    if (saveQueued) flushState();
  }
}

async function loadWorkspace(tenantId, preferredProjectId = null) {
  currentTenantId = tenantId;
  const bootstrap = await api('/api/bootstrap');
  currentUser = bootstrap.user; tenants = bootstrap.tenants;
  const pref = preferences();
  const project = bootstrap.projects.find((item) => item.id === preferredProjectId)
    || bootstrap.projects.find((item) => item.id === pref.projectId)
    || bootstrap.projects[0];
  if (!project) {
    state = { ...structuredClone(seed), organizations: bootstrap.organizations, projects: bootstrap.projects, activeOrg: bootstrap.organizations[0]?.id || null, activeProject: null };
  } else {
    const [stored, inventory, auditTrail] = await Promise.all([
      api(`/api/projects/${project.id}/state`),
      api(`/api/documents?organizationId=${encodeURIComponent(project.orgId)}&projectId=${encodeURIComponent(project.id)}`),
      api('/api/audit'),
    ]);
    stateVersion = stored.version;
    state = { ...structuredClone(seed), ...stored.data, organizations: bootstrap.organizations, projects: bootstrap.projects, documents: inventory.documents, audit: mapAuditEvents(auditTrail.events), activeOrg: project.orgId, activeProject: project.id, activeView: pref.activeView || 'dashboard' };
  }
  savePreferences();
  showApplication();
  render();
}

async function switchProject(projectId) {
  await flushState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const [stored, inventory, auditTrail] = await Promise.all([api(`/api/projects/${project.id}/state`), api(`/api/documents?organizationId=${encodeURIComponent(project.orgId)}&projectId=${encodeURIComponent(project.id)}`), api('/api/audit')]);
  stateVersion = stored.version;
  const globals = { organizations: state.organizations, projects: state.projects };
  state = { ...structuredClone(seed), ...stored.data, ...globals, documents: inventory.documents, audit: mapAuditEvents(auditTrail.events), activeOrg: project.orgId, activeProject: project.id, activeView: state.activeView };
  savePreferences(); render();
}

function mapAuditEvents(events) {
  const labels = { 'document.uploaded':'Arquivo enviado', 'document.downloaded':'Arquivo baixado', 'document.deleted':'Arquivo excluído', 'organization.created':'Empresa criada', 'organization.updated':'Empresa atualizada', 'project.created':'Diagnóstico criado' };
  return events.map((event) => ({ at:new Date(event.createdAt).toLocaleString('pt-BR'), user:event.userName, event:`${labels[event.action] || event.action}${event.details?.name ? `: ${event.details.name}` : ''}`, version:event.entityType.toUpperCase() }));
}
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
  const tenantSelect = document.querySelector("#tenantSelect");
  tenantSelect.innerHTML = tenants.map((tenant) => `<option value="${tenant.id}" ${tenant.id === currentTenantId ? "selected" : ""}>${tenant.name}</option>`).join("");
  document.querySelector('#tenantContext').hidden = tenants.length < 2;
  const orgSelect = document.querySelector("#orgSelect");
  orgSelect.innerHTML = state.organizations.map((org) => `<option value="${org.id}" ${org.id === state.activeOrg ? "selected" : ""}>${org.name}</option>`).join("");
  const projects = state.projects.filter((item) => item.orgId === state.activeOrg);
  if (!projects.some((item) => item.id === state.activeProject)) state.activeProject = projects[0]?.id;
  document.querySelector("#projectSelect").innerHTML = projects.map((project) => `<option value="${project.id}" ${project.id === state.activeProject ? "selected" : ""}>${project.name}</option>`).join("");
  document.querySelector("#notificationCount").textContent = pendingCount();
  document.querySelector("#coverageMini").textContent = `${score()}%`;
  document.querySelector("#coverageBar").style.width = `${score()}%`;
  document.querySelector('#profileName').textContent = currentUser?.name || 'Usuário';
  document.querySelector('#profileRole').textContent = currentUser?.isPlatformAdmin ? 'Administrador da plataforma' : 'Usuário autorizado';
  document.querySelector('#profileInitials').textContent = (currentUser?.name || '--').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function renderDashboard() {
  const calc = calculateScenario(state.scenario);
  const years = transitionYears(state.scenario);
  const maxTax = Math.max(1, ...years.map((x) => x.blendedTax));
  const impacts = [...state.findings].sort((a,b) => b.impact-a.impact).slice(0,4);
  const hasProject = Boolean(state.activeProject);
  return `${pageHead("Visão executiva", `Bom dia, ${document.querySelector(".profile strong").textContent.split(" ")[0]}.`, hasProject ? "Veja o que afeta o resultado, o que pode acontecer e o que precisa ser feito antes." : "O ambiente está limpo. Cadastre a primeira empresa real para iniciar o diagnóstico.", `${hasProject ? '<button class="ghost" data-view="relatorios">Ver relatório</button>' : ''}<button class="button gold" data-action="new-diagnosis">Novo diagnóstico</button>`)}
    <div class="notice"><strong>${hasProject ? 'Diagnóstico em construção.' : 'Nenhum dado demonstrativo.'}</strong> ${hasProject ? 'Os indicadores serão preenchidos apenas por dados e validações deste projeto.' : 'Empresas, documentos, achados e métricas aparecerão somente após cadastro e processamento reais.'}</div>
    <section class="grid metrics" aria-label="Indicadores principais">
      ${metric("Oportunidades mapeadas", money.format(state.findings.reduce((s,x)=>s+x.impact,0)), state.findings.length ? "Soma dos impactos estimados dos achados" : "Nenhum achado processado", "↗")}
      ${metric("Economia potencial", money.format(Math.max(0, calc.delta * 12)), state.scenario.revenue > 0 ? "Estimativa calculada — não realizada" : "Sem premissas reais informadas", "◎")}
      ${metric("Ações em andamento", state.actions.filter((x)=>x.status === "Em andamento").length, `${state.actions.filter((x)=>x.status !== "Concluído").length} ações abertas`, "✓")}
      ${metric("Confiabilidade dos dados", `${score()}%`, qualityStatus(score()).label, "◉")}
    </section>
    <section class="grid two-col">
      <article class="card"><div class="card-head"><div><h3>Projeção da carga tributária</h3><p>Transição 2026–2033 com premissas editáveis</p></div><button class="ghost" data-view="cenarios">Simular</button></div>
        <div class="chart">${years.map((row)=>`<div class="bar-group"><i class="bar" style="height:${calc.currentTax > 0 ? Math.max(8, calc.currentTax/maxTax*100) : 0}%" title="Atual: ${money.format(calc.currentTax)}"></i><i class="bar alt" style="height:${row.blendedTax > 0 ? Math.max(8,row.blendedTax/maxTax*100) : 0}%" title="Projetado: ${money.format(row.blendedTax)}"></i><label>${row.year}</label></div>`).join("")}</div>
        <div class="legend"><span><i></i>Regime atual</span><span><i class="alt"></i>Cenário projetado</span></div>
      </article>
      <article class="card"><div class="card-head"><div><h3>Qualidade do diagnóstico</h3><p>Empresa, período e módulos ativos</p></div>${status(qualityStatus(score()).label)}</div>
        <div class="quality-ring" style="--score:${score()}"><span>${score()}<small>de 100</small></span></div>
        <div class="quality-lines">${Object.entries({coverage:"Cobertura documental",reconciliation:"Conciliação",integrity:"Integridade dos campos",validated:"Itens validados"}).map(([key,label])=>`<div class="quality-line"><span>${label}</span><strong>${state.quality[key]}%</strong><div><i style="width:${state.quality[key]}%"></i></div></div>`).join("")}</div>
      </article>
    </section>
    <section class="grid two-col" style="margin-top:18px">
      <article class="card"><div class="card-head"><div><h3>Impactos prioritários</h3><p>Ordenados por valor e materialidade</p></div><button class="ghost" data-view="achados">Ver todos</button></div>
        <ul class="impact-list">${impacts.length ? impacts.map((item)=>`<li><span class="impact-icon">${item.area.slice(0,1)}</span><span><strong>${item.title}</strong><small>${item.area} · confiança ${item.confidence}%</small></span><span class="impact-value">${money.format(item.impact)}</span></li>`).join("") : '<li><span><strong>Nenhum impacto apurado</strong><small>Importe e processe dados reais para gerar achados.</small></span></li>'}</ul>
      </article>
      <article class="card"><div class="card-head"><div><h3>Próximas decisões</h3><p>Prazos que merecem atenção</p></div></div>
        <ul class="timeline">${state.actions.filter((x)=>x.status!=="Concluído").slice(0,4).map((item)=>`<li><span class="impact-icon">${item.due.slice(0,2)}</span><span><strong>${item.title}</strong><small>${item.owner} · ${item.horizon}</small></span></li>`).join("") || '<li><span><strong>Nenhuma decisão pendente</strong><small>As ações reais deste projeto aparecerão aqui.</small></span></li>'}</ul>
      </article>
    </section>`;
}
function metric(label, value, delta, icon) { return `<article class="card metric"><div class="metric-label"><span>${label}</span><span>${icon}</span></div><strong>${value}</strong><span class="delta">${delta}</span></article>`; }

function renderDiagnosticos() {
  const q = qualityStatus(score());
  const openFindings = state.findings.filter((item) => item.status !== 'Concluído').length;
  const stages = [["Cadastro",true],["Documentos",state.documents.length > 0],["Conciliação",state.quality.reconciliation > 0],["Classificação",state.findings.length > 0],["Cenários",state.scenario.revenue > 0],["Liberação",score() >= 80 && openFindings === 0]];
  const currentStage = Math.max(0, stages.findIndex(([, done]) => !done));
  const executionId = `EXEC-${String(activeProject().id).slice(0, 8).toUpperCase()}`;
  const motorLabel = state.rules.length ? `v${state.rules[state.rules.length - 1].version}` : 'Nenhum motor homologado';
  const pendingItems = state.findings.filter((item) => item.status === 'Condicional' || item.status === 'Revisão');
  return `${pageHead("Jornada do diagnóstico", "Diagnósticos", "Cada execução preserva dados, regras, premissas e resultados para reprodução e auditoria.", `<button class="button gold" data-action="new-diagnosis">Novo diagnóstico</button>`)}
    <section class="card"><div class="card-head"><div><h3>${activeProject().name}</h3><p>${activeOrg().name} · ${activeProject().period} · pacote ${activeProject().package}</p></div>${status(activeProject().status)}</div>
      <div class="workflow">${stages.map(([label,done],i)=>`<div class="workflow-step ${done?"done":i===currentStage?"current":""}"><b>${done?"✓":i+1}</b><strong>${label}</strong><small>${done?"Concluído":i===currentStage?"Próxima etapa":"Aguardando"}</small></div>`).join("")}</div>
    </section>
    <section class="grid two-col" style="margin-top:18px">
      <article class="card"><div class="card-head"><div><h3>Contrato da execução</h3><p>Identificação e governança obrigatórias</p></div><span class="pill">${executionId}</span></div>
        <div class="table-wrap"><table><tbody>
          <tr><th>Organização</th><td>${activeOrg().name}<br><small>${activeOrg().cnpj} · ${activeOrg().city}</small></td></tr>
          <tr><th>Escopo</th><td>${activeProject().scope}</td></tr><tr><th>Competência</th><td>${activeProject().period}</td></tr>
          <tr><th>Motor</th><td>${motorLabel}</td></tr><tr><th>Qualidade</th><td>${status(q.label)} ${score()}% de confiança</td></tr>
          <tr><th>Decisão</th><td>${pendingItems.length ? `Liberação condicionada à resolução de ${pendingItems.length} pendência(s) real(is)` : 'Nenhuma restrição material registrada até o momento'}</td></tr>
        </tbody></table></div>
      </article>
      <article class="card"><div class="card-head"><div><h3>Dependências e bloqueios</h3><p>O sistema informa exatamente o que falta</p></div></div>
        <ul class="check-list">${pendingItems.length ? pendingItems.map((item)=>`<li class="notice">⚠ ${item.title}</li>`).join('') : '<li>Nenhuma pendência registrada. O sistema exibirá aqui somente exceções geradas a partir dos dados reais.</li>'}</ul>
        <button class="button full" data-view="achados">Tratar exceções</button>
      </article>
    </section>`;
}

function renderImportacao() {
  return `${pageHead("Base auditável", "Dados e importação", "Preserve o original, registre a origem e acompanhe integridade, cobertura e erros por arquivo.", `<button class="ghost" data-action="export-data">Exportar inventário</button><button class="button gold" data-action="pick-files">Importar arquivos</button>`)}
    <section class="dropzone" id="dropzone"><div><div class="dropzone-icon">⇧</div><h2>Solte seus arquivos aqui</h2><p>XML, ZIP, CSV, XLSX, PDF e TXT. XML e CSV são lidos diretamente; demais formatos entram na fila de processamento do ambiente.</p><button class="button" data-action="pick-files">Selecionar arquivos</button></div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h3>Arquivos recebidos</h3><p>${state.documents.reduce((sum,x)=>sum+(x.records||0),0).toLocaleString("pt-BR")} registros identificados</p></div>${status(`Cobertura ${state.quality.coverage}%`)}</div>
      <div class="grid">${state.documents.map((file)=>`<div class="file-row"><span class="file-icon">${file.type.split("/")[0]}</span><span><strong>${file.name}</strong><small>${file.size} · ${file.records || 0} registros · ${file.at}</small></span>${status(file.status)}<button class="icon-button" data-file="${file.id}" aria-label="Detalhes do arquivo">›</button></div>`).join("")}</div>
    </section>`;
}

function renderCenarios() {
  const calc = calculateScenario(state.scenario);
  const years = transitionYears(state.scenario);
  return `${pageHead("Previsibilidade", "Cenários 2026–2033", "Compare alternativas equivalentes, identifique pontos de virada e veja quais premissas sustentam a recomendação.", `<button class="ghost" data-action="reset-scenario">Restaurar premissas</button><button class="button gold" data-action="save-scenario">Salvar versão</button>`)}
    <div class="notice"><strong>Premissas transparentes:</strong> alíquotas de referência são editáveis e precisam ser classificadas como oficiais ou estimadas. ${state.scenario.revenue > 0 ? 'Os resultados abaixo usam exclusivamente as premissas salvas neste projeto.' : 'Nenhuma premissa real foi informada; os resultados permanecem zerados.'}</div>
    <section class="grid two-col">
      <article class="card"><div class="card-head"><div><h3>Premissas do cenário</h3><p>Mesmo período, volume, mix e preços</p></div><span class="pill">RASCUNHO</span></div>
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
    <article class="card" id="report"><div class="report-cover"><div class="eyebrow">Diagnóstico 360 · Relatório executivo</div><h2>${activeOrg().name}</h2><p>${activeProject().period} · EXEC-${String(activeProject().id).slice(0, 8).toUpperCase()}</p><p>PREVISIBILIDADE PARA DECIDIR ANTES QUE O IMPACTO ACONTEÇA.</p></div>
      <section class="report-section"><div class="card-head"><div><h2>Situação atual</h2><p>Leitura executiva do diagnóstico</p></div>${status(qualityStatus(score()).label)}</div><p>Foram identificados ${state.documents.reduce((s,x)=>s+(x.records||0),0).toLocaleString("pt-BR")} registros nos arquivos processados, com ${score()}% de confiabilidade calculada. Conclusões somente serão apresentadas quando houver evidências e regras vinculadas.</p></section>
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
  if (!state.activeProject && state.activeView !== 'dashboard') state.activeView = 'dashboard';
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
    <label class="field" style="grid-column:1/-1"><span>Nome da organização</span><input name="orgName" required></label><label class="field"><span>CNPJ</span><input name="cnpj" required></label><label class="field"><span>Regime</span><select name="regime"><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></label><label class="field"><span>Nome do projeto</span><input name="projectName" placeholder="Ex.: Diagnóstico tributário anual" required></label><label class="field"><span>Período</span><input name="period" placeholder="Ex.: 01/2026–12/2026" required></label><label class="field" style="grid-column:1/-1"><span>Objetivo do estudo</span><textarea name="scope" placeholder="Descreva o escopo real desta execução" required></textarea></label><button class="button gold" style="grid-column:1/-1">Criar diagnóstico</button></form>`);
}
function ruleDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Governança metodológica</div><h2>Nova regra</h2></div><button class="close" data-action="close-dialog">×</button></div><form id="ruleForm" class="form-grid"><label class="field"><span>Identificador</span><input name="id" required></label><label class="field"><span>Tema</span><input name="theme" required></label><label class="field" style="grid-column:1/-1"><span>Título</span><input name="title" required></label><label class="field" style="grid-column:1/-1"><span>Fonte oficial e dispositivo</span><textarea name="source" required></textarea></label><label class="field"><span>Versão</span><input name="version" required></label><label class="field"><span>Vigência</span><input name="effective" type="date" required></label><button class="button gold" style="grid-column:1/-1">Salvar para revisão</button></form>`);
}
function methodDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Metodologia e limites</div><h2>Clareza sem falsa certeza</h2></div><button class="close" data-action="close-dialog">×</button></div><p>O Diagnóstico 360 conecta dados, regras e cenários. Resultados automáticos só são liberados dentro de pacotes legais homologados e com cobertura suficiente.</p><ul><li>Estimativas são visualmente distintas de valores confirmados.</li><li>Crédito potencial não é apresentado como crédito realizado.</li><li>Exceções materiais seguem para revisão especializada.</li><li>Cada número retorna à evidência, fórmula, regra e versão.</li><li>O sistema não substitui parecer jurídico ou responsabilidade profissional.</li></ul>`);
}
function profileDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Perfil autenticado</div><h2>${currentUser.name}</h2></div><button class="close" data-action="close-dialog">×</button></div><p>${currentUser.email}</p><div class="notice">Sessão protegida no servidor · acesso isolado por tenant · arquivos centralizados com hash SHA-256.</div><div class="actions"><button class="button" data-action="change-password">Alterar senha</button><button class="ghost" data-action="logout">Sair da plataforma</button></div>`);
}
function passwordDialog() {
  openDialog(`<div class="dialog-head"><div><div class="eyebrow">Segurança da conta</div><h2>${currentUser.mustChangePassword ? 'Defina sua nova senha' : 'Alterar senha'}</h2></div>${currentUser.mustChangePassword ? '' : '<button class="close" data-action="close-dialog">×</button>'}</div><p>A nova senha deve ter pelo menos 12 caracteres.</p><form id="passwordForm" class="form-grid"><label class="field" style="grid-column:1/-1"><span>Senha atual</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field"><span>Nova senha</span><input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label><label class="field"><span>Confirmar nova senha</span><input name="confirmation" type="password" autocomplete="new-password" minlength="12" required></label><button class="button gold" style="grid-column:1/-1">Salvar nova senha</button></form>`);
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
  if (!state.activeOrg || !state.activeProject) return toast('Selecione uma organização e um projeto antes de importar.');
  const form = new FormData();
  form.append('organizationId', state.activeOrg); form.append('projectId', state.activeProject);
  files.forEach((file) => form.append('files', file, file.name));
  toast(`Enviando ${files.length} arquivo(s) ao armazenamento central…`);
  try {
    const result = await api('/api/documents', { method: 'POST', body: form });
    state.documents.unshift(...result.documents);
    state.quality.coverage = Math.min(100, state.quality.coverage + files.length);
    saveState(); render(); toast(`${files.length} arquivo(s) salvo(s) no servidor com hash SHA-256.`);
  } catch (error) { toast(`Falha no upload: ${error.message}`); }
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
  if (target.dataset.file) { const file=state.documents.find(x=>x.id===target.dataset.file); openDialog(`<div class="dialog-head"><h2>${file.name}</h2><button class="close" data-action="close-dialog">×</button></div><p>${status(file.status)}</p><p><strong>Integridade:</strong> ${file.integrity}</p><p><strong>Tamanho:</strong> ${file.size}</p><p><strong>Registros:</strong> ${file.records}</p><p><strong>Recebido:</strong> ${file.at}</p><div class="actions"><button class="button" data-download-file="${file.id}">Baixar original</button><button class="ghost" data-delete-file="${file.id}">Excluir</button></div>`); return; }
  if (target.dataset.downloadFile) { window.location.href=`/api/documents/${target.dataset.downloadFile}/download?tenantId=${encodeURIComponent(currentTenantId)}`; return; }
  if (target.dataset.deleteFile) { if (!confirm('Excluir este arquivo do inventário? A ação ficará registrada na auditoria.')) return; api(`/api/documents/${target.dataset.deleteFile}`, { method:'DELETE' }).then(()=>{ state.documents=state.documents.filter(x=>x.id!==target.dataset.deleteFile); closeDialog(); render(); toast('Arquivo excluído e ação registrada.'); }).catch((error)=>toast(error.message)); return; }
  if (target.dataset.advance) { const item=state.actions.find(x=>x.id===target.dataset.advance); const stages=["A fazer","Em andamento","Em validação","Concluído"]; if(item.status!=="Concluído") item.status=stages[Math.min(3,stages.indexOf(item.status)+1)]; saveState(); render(); toast("Etapa atualizada no projeto."); return; }
  const action = target.dataset.action;
  if (action === "toggle-menu") document.querySelector("#sidebar").classList.toggle("open");
  if (action === "go-pending") { state.activeView="achados"; saveState(); render(); }
  if (action === "pick-files") fileInput.click();
  if (action === "close-dialog") closeDialog();
  if (action === "open-method") methodDialog();
  if (action === "profile") profileDialog();
  if (action === "change-password") passwordDialog();
  if (action === "logout") { api('/api/auth/logout', { method:'POST' }).finally(()=>location.reload()); }
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
  if (action === "save-scenario") { const version=`CEN-${state.audit.filter((item)=>item.event==="Premissas do cenário salvas").length+1}`; state.audit.unshift({at:new Date().toLocaleString("pt-BR"),user:currentUser.name,event:"Premissas do cenário salvas",version});saveState();toast(`Cenário salvo como ${version}.`); }
  if (action === "reset-scenario") { state.scenario=structuredClone(seed.scenario);saveState();render();toast("Premissas restauradas."); }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#scenarioForm") && event.target.name) { state.scenario[event.target.name]=Number(event.target.value); saveState(); render(); }
});
document.addEventListener("submit", async (event) => {
  if (event.target.id === 'loginForm') return;
  event.preventDefault(); const data=Object.fromEntries(new FormData(event.target));
  if (event.target.id === "quickForm") {
    if (event.target.dataset.kind === "action") state.actions.unshift({id:`ACT-${String(state.actions.length+1).padStart(2,"0")}`,title:data.title,owner:data.owner,due:new Date(`${data.due}T12:00`).toLocaleDateString("pt-BR"),finding:data.finding,horizon:data.horizon,status:"A fazer",priority:"Média"});
    else state.findings.unshift({id:`ACH-${String(state.findings.length+1).padStart(3,"0")}`,area:data.area,title:data.title,impact:Number(data.impact),priority:"Média",confidence:50,status:"Condicional",evidence:data.evidence,rule:"Fundamento pendente",cause:"Em apuração",condition:"Depende de revisão e evidência complementar."});
  }
  if (event.target.id === "diagnosisForm") {
    try {
      const organization = await api('/api/organizations', { method:'POST', body:JSON.stringify({ name:data.orgName, cnpj:data.cnpj, regime:data.regime, city:'Não informado', sector:'A classificar' }) });
      const project = await api('/api/projects', { method:'POST', body:JSON.stringify({ organizationId:organization.id, name:data.projectName, period:data.period, scope:data.scope, status:'Coleta', package:'A HOMOLOGAR' }) });
      closeDialog(); await loadWorkspace(currentTenantId, project.id); state.activeView='diagnosticos'; savePreferences(); render(); toast('Empresa e diagnóstico criados no banco de dados.');
    } catch (error) { toast(`Não foi possível criar o diagnóstico: ${error.message}`); }
    return;
  }
  if (event.target.id === "ruleForm") state.rules.unshift({...data,status:"Em revisão"});
  if (event.target.id === 'passwordForm') {
    if (data.newPassword !== data.confirmation) return toast('A confirmação da nova senha não confere.');
    try { await api('/api/auth/change-password', { method:'POST', body:JSON.stringify({ currentPassword:data.currentPassword, newPassword:data.newPassword }) }); toast('Senha alterada. Entre novamente.'); setTimeout(()=>location.reload(), 800); }
    catch (error) { toast(error.message); }
    return;
  }
  saveState(); closeDialog(); render(); toast("Registro salvo com sucesso.");
});
document.querySelector("#orgSelect").addEventListener("change", async (event)=>{ const project=state.projects.find(x=>x.orgId===event.target.value); if(project) await switchProject(project.id); else { state.activeOrg=event.target.value; state.activeProject=null; savePreferences(); render(); } });
document.querySelector("#projectSelect").addEventListener("change", async (event)=>{ await switchProject(event.target.value); });
document.querySelector("#tenantSelect").addEventListener("change", async (event)=>{ await flushState(); await loadWorkspace(event.target.value); });
fileInput.addEventListener("change",()=>{handleFiles([...fileInput.files]);fileInput.value="";});
dialog.addEventListener("click",(event)=>{if(event.target===dialog) closeDialog();});

function showLogin(message = '') {
  document.querySelector('#appShell').hidden = true;
  document.querySelector('#loginScreen').hidden = false;
  document.querySelector('#loginError').textContent = message;
}

function showApplication() {
  document.querySelector('#loginScreen').hidden = true;
  document.querySelector('#appShell').hidden = false;
}

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try { await api('/api/auth/login', { method:'POST', body:JSON.stringify(data) }); await boot(); }
  catch (error) { showLogin(error.message); }
  finally { button.disabled = false; }
});

async function boot() {
  try {
    const identity = await api('/api/auth/me');
    currentUser = identity.user; tenants = identity.tenants;
    const preferred = preferences().tenantId;
    const tenantId = tenants.some((item)=>item.id===preferred) ? preferred : tenants[0]?.id;
    if (!tenantId) throw new Error('Sua conta não possui acesso a nenhum tenant.');
    await loadWorkspace(tenantId);
    if (currentUser.mustChangePassword) passwordDialog();
  } catch (error) {
    showLogin(error.status === 401 ? '' : error.message);
  }
}

boot();
