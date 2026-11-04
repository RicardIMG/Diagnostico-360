# Matriz de requisitos — Diagnóstico 360

Esta matriz traduz os 29 critérios de aceite do briefing funcional para o estado verificável da versão 2. Persistência compartilhada significa API e banco no servidor; armazenamento central significa objeto original fora do navegador. O processamento fiscal é classificado separadamente para não confundir arquivo armazenado com documento analisado.

| # | Critério | Estado nesta entrega | Próxima etapa de produção |
|---:|---|---|---|
| 1 | Organizações, usuários, CNPJs, projetos e períodos | Organizações, CNPJs, projetos, períodos, tenants, sessões e vínculos persistidos no servidor | Completar telas de administração de usuários e políticas finas de RBAC |
| 2 | Importar XML, ZIP, XLSX, CSV e PDF | Upload real, original armazenado, SHA-256, inventário, download e exclusão auditável | Workers de parsing, antivírus e extração de ZIP/PDF/XLSX |
| 3 | Auditoria de XML por documento e item | Estrutura de importação e contagem XML | Motor completo da NT 2025.002 e tabelas oficiais |
| 4 | Conciliação e cobertura | Nota e estado de cobertura funcionais | Conciliação automática contra fontes reais |
| 5 | Classificação de receitas | Modelo de achado e regra versionada | Regras homologadas por NCM/NBS/operação/competência |
| 6 | Simular DAS versus IBS/CBS regular | Funcional e testado | Homologação das fórmulas e parâmetros oficiais |
| 7 | Débitos, créditos, margem, preço e caixa | Cálculo funcional com memória visível | Motor item a item e razão de cálculo persistida |
| 8 | Premissas, confiança, pendências e fonte | Estado analítico persistido e versionado por projeto | Vincular cada conclusão às linhas e itens processados |
| 9 | Rankings de clientes e fornecedores | Dados e cálculo ABC no núcleo | Telas de ranking alimentadas por dados reais |
| 10 | Inventário de oportunidades | Funcional em achados priorizados | Ampliação automática aos 22 blocos |
| 11 | Relatório executivo, técnico, memória e plano | Executivo imprimível, CSV/JSON e plano funcionais | DOCX/XLSX/PDF no servidor e dossiê técnico completo |
| 12 | Linha de base, ação, evidência e resultado | Ações e estados persistidos por projeto | Tipar anexos de evidência e medição antes/depois |
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
| 23 | Fila única de exceções e aprovações | Achados e ações persistidos | SLA, comentários, anexos e notificações |
| 24 | Isolamento e testes de falha | Banco multi-tenant, autorização no servidor e teste automatizado de isolamento | MFA, testes de restauração, pentest e observabilidade de produção |
| 25 | Aceite de premissas pelo cliente | Premissas visíveis e versionáveis | Assinatura/aceite autenticado |
| 26 | Liberação automática dentro da cobertura | Regra exibida | Enforcement com pacote homologado e RBAC |
| 27 | Versão de motor, normas, dados, usuário e data | Sessão, usuário, data, SHA-256, versão do estado e auditoria persistidos | Assinatura/imutabilidade externa dos logs e versão do worker |
| 28 | Reprocessamento preservando versão | Concorrência protegida por versão do estado | Snapshots completos, reprocessamento seletivo e diff técnico |
| 29 | Testes unitários e casos anonimizados | 5 testes automatizados, incluindo backend, isolamento e upload | Suíte normativa por setor e casos reais homologados |

## Decisão de arquitetura

A versão 2 utiliza API Node.js, MySQL em produção e armazenamento S3 compatível. SQLite e disco local são permitidos apenas em desenvolvimento. A implantação produtiva ainda precisa provisionar banco, bucket, segredos, backups, monitoramento, antivírus e workers de processamento. A aplicação bloqueia uma configuração produtiva que tente usar banco ou arquivos locais.
