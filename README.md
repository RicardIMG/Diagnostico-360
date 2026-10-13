# Diagnóstico 360

Aplicação web demonstrável para transformar dados fiscais, tributários, contábeis, financeiros e operacionais em cenários, achados e ações rastreáveis.

## Executar

Requer Node.js 20 ou superior.

```powershell
npm start
```

Acesse `http://127.0.0.1:4173`.

Como alternativa, a imagem de implantação está pronta:

```powershell
docker build -t diagnostico-360 .
docker run --rm -p 8080:80 diagnostico-360
```

Acesse `http://127.0.0.1:8080`.

## Testes

```powershell
npm test
```

## Funcionalidades da versão

- visão executiva com impactos, qualidade dos dados e projeção 2026–2033;
- jornada de diagnóstico e bloqueios por dependência;
- importação local de XML e CSV, inventário de arquivos e estados de processamento;
- simulador de DAS versus regime regular IBS/CBS, créditos, margem e caixa;
- achados rastreáveis com causa, evidência, fundamento e condição de validade;
- plano 30/60/90 dias em kanban;
- relatório executivo imprimível ou salvável em PDF pelo navegador;
- matriz de cobertura, regras versionadas e trilha de auditoria;
- persistência local no navegador e exportação CSV/JSON.

## Limite da versão local

Esta entrega é uma aplicação web local e demonstrável. Antes de uso produtivo com dados reais, a etapa de VPS deve acrescentar banco de dados, autenticação/MFA, isolamento multiempresa no servidor, criptografia em repouso, armazenamento seguro dos originais, filas assíncronas, backups, observabilidade, integração de correio e homologação dos pacotes legais. A interface identifica estimativas e não trata projeções como resultado garantido.
