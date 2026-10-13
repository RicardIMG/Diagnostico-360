# Matriz de requisitos — Diagnóstico 360

Esta matriz traduz os 29 critérios de aceite do briefing funcional para o estado verificável desta entrega. “Funcional local” significa que o fluxo opera no navegador e persiste no próprio dispositivo. “VPS/backend” exige infraestrutura de produção, segredo, banco ou serviço externo e não deve ser simulado como segurança real.

| # | Critério | Estado nesta entrega | Próxima etapa de produção |
|---:|---|---|---|
| 1 | Organizações, usuários, CNPJs, projetos e períodos | Funcional local para organizações, CNPJs, projetos e períodos | Usuários, RBAC e isolamento no banco |
| 2 | Importar XML, ZIP, XLSX, CSV e PDF | XML/CSV lidos; demais formatos registrados em fila | Workers de parsing, antivírus e armazenamento de originais |
| 3 | Auditoria de XML por documento e item | Estrutura de importação e contagem XML | Motor completo da NT 2025.002 e tabelas oficiais |
| 4 | Conciliação e cobertura | Nota e estado de cobertura funcionais | Conciliação automática contra fontes reais |
| 5 | Classificação de receitas | Modelo de achado e regra versionada | Regras homologadas por NCM/NBS/operação/competência |
| 6 | Simular DAS versus IBS/CBS regular | Funcional e testado | Homologação das fórmulas e parâmetros oficiais |
| 7 | Débitos, créditos, margem, preço e caixa | Cálculo funcional com memória visível | Motor item a item e razão de cálculo persistida |
| 8 | Premissas, confiança, pendências e fonte | Funcional na interface | Evidência documental persistida por resultado |
| 9 | Rankings de clientes e fornecedores | Dados e cálculo ABC no núcleo | Telas de ranking alimentadas por dados reais |
| 10 | Inventário de oportunidades | Funcional em achados priorizados | Ampliação automática aos 22 blocos |
| 11 | Relatório executivo, técnico, memória e plano | Executivo imprimível, CSV/JSON e plano funcionais | DOCX/XLSX/PDF no servidor e dossiê técnico completo |
| 12 | Linha de base, ação, evidência e resultado | Ações e estados funcionais | Upload de evidências e medição persistida antes/depois |
| 13 | Créditos PIS/Cofins por item e EFD | Modelo de achado/crédito | Parser EFD, conciliação e regras homologadas |
| 14 | Dossiê PER/DCOMP sem transmissão indevida | Limite do produto documentado | Gerador assistido com autorização e governança |
| 15 | Estoque e crédito presumido CBS | Matriz de cobertura | Motor de inventário, documentos e 12 parcelas |
| 16 | Grupo econômico e reorganização | Regra de bloqueio/revisão prevista | Consolidação, eliminações e validação profissional |
| 17 | Matriz de cobertura e bloqueios | Funcional | Administração de pacotes homologados no backend |
| 18 | PMR, PMP, ciclos e projeção financeira | Achado e cenário demonstráveis | Importação de contas e cálculo por dimensão |
| 19 | Split payment separado dos prazos | Cobertura e regra identificadas | Motor financeiro específico após regulamentação |
| 20 | Saída padronizada de cada bloco | Contrato da execução modelado | Persistência do contrato para todos os blocos |
| 21 | Bloqueio por dependência | Funcional e explícito | Enforcement no motor do servidor |
| 22 | Reprocessamento seletivo e versões | Histórico e versão demonstráveis | Grafo de dependências e fila assíncrona |
| 23 | Fila única de exceções e aprovações | Funcional em achados e ações | SLA, comentários, anexos e notificações |
| 24 | Isolamento e testes de falha | Cabeçalhos seguros e arquitetura preparada | Banco multi-tenant, MFA, testes de permissão e restauração |
| 25 | Aceite de premissas pelo cliente | Premissas visíveis e versionáveis | Assinatura/aceite autenticado |
| 26 | Liberação automática dentro da cobertura | Regra exibida | Enforcement com pacote homologado e RBAC |
| 27 | Versão de motor, normas, dados, usuário e data | Funcional na execução e auditoria | Hashes criptográficos e log imutável no servidor |
| 28 | Reprocessamento preservando versão | Fluxo e comparação previstos | Persistência de snapshots e diff técnico |
| 29 | Testes unitários e casos anonimizados | 4 testes críticos automatizados | Suíte normativa por setor e casos reais homologados |

## Decisão de arquitetura

A entrega atual é buildless, sem dependências externas e pronta para servir como arquivos estáticos. Isso permite demonstração imediata e implantação simples. Para tratar dados empresariais reais, a implantação no VPS deve introduzir uma API, banco relacional, filas, armazenamento de objetos, autenticação forte, criptografia em repouso, backups testados, logs imutáveis e segregação por organização. O frontend já separa estimativa, confirmação, condição de validade e cobertura para não apresentar falsa certeza.
