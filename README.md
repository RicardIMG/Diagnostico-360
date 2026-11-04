# Diagnóstico 360

Plataforma web multi-tenant para diagnósticos fiscais, tributários, contábeis, financeiros e operacionais. A versão 2 substitui a persistência exclusiva do navegador por API, banco relacional, armazenamento centralizado de arquivos e controle de acesso no servidor.

## O que está implementado

- autenticação por sessão `HttpOnly`, `SameSite=Strict`, expiração configurável e senhas com `scrypt`;
- autorização por tenant em todas as operações de dados;
- administrador da plataforma com acesso explícito a múltiplos tenants;
- organizações e projetos persistidos no banco;
- estado analítico por projeto com versionamento otimista contra sobrescrita concorrente;
- upload real dos arquivos originais para armazenamento local no desenvolvimento ou S3 compatível em produção;
- inventário filtrado por tenant, organização e projeto;
- SHA-256 calculado no servidor, download autenticado e exclusão lógica auditável;
- trilha de auditoria para cadastro, alteração, upload, download e exclusão;
- limite de upload, rate limit no login, cabeçalhos seguros e bloqueio de origem cruzada;
- MySQL em produção e SQLite somente para desenvolvimento/testes;
- testes automatizados de autenticação, isolamento de tenant, persistência e integridade.

## Desenvolvimento local

Requer Node.js 20 ou superior.

```powershell
npm install
npm start
```

Acesse `http://127.0.0.1:4173`. Na primeira execução local, a conta padrão é `admin@diagnostico360.local` / `troque-esta-senha`. Ela existe exclusivamente para desenvolvimento e não é aceita automaticamente em produção.

Os dados locais ficam em `data/`, que não é versionado.

## Testes e auditoria

```powershell
npm test
npm audit --omit=dev
```

## Produção

A aplicação recusa inicialização em `NODE_ENV=production` se estiver configurada com SQLite ou armazenamento local. Configure:

```text
NODE_ENV=production
DB_DIALECT=mysql
DATABASE_URL=mysql://USUARIO:SENHA@HOST:3306/BANCO
STORAGE_DRIVER=s3
S3_ENDPOINT=https://endpoint-do-provedor
S3_REGION=us-east-1
S3_BUCKET=diagnostico360
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
COOKIE_SECURE=true
TRUST_PROXY=true
BOOTSTRAP_TENANT_NAME=Diagnóstico 360
BOOTSTRAP_ADMIN_NAME=Administrador
BOOTSTRAP_ADMIN_EMAIL=...
BOOTSTRAP_ADMIN_PASSWORD=...
```

O endpoint de saúde é `GET /api/health`. Não coloque segredos no Git, no frontend ou em arquivos de imagem Docker.

## Modelo de segurança

Tenant é uma fronteira de autorização, não apenas um filtro visual. Toda consulta inclui `tenant_id`; organizações, projetos, estados, documentos e auditoria carregam essa chave. Usuários comuns precisam de vínculo em `memberships`; somente `is_platform_admin` pode atravessar tenants conscientemente.

Arquivos são armazenados com uma chave que contém tenant, organização e projeto. O nome original não compõe o caminho físico. Downloads passam pela mesma autorização da consulta. A exclusão padrão é lógica para preservar auditoria e permitir política de retenção.

## Limites ainda existentes

Persistência e isolamento estão implementados. O processamento tributário completo de ZIP, PDF, XLSX, EFD e conciliações item a item continua sendo um motor separado e precisa de regras homologadas, filas de workers, antivírus e casos de teste normativos. Um arquivo com estado “Na fila” está armazenado com segurança, mas ainda não foi interpretado pelo motor fiscal.
