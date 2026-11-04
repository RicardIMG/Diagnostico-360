# Implantação de produção — Diagnóstico 360 v2

## Recursos obrigatórios

1. Aplicação Node.js 20 ou superior.
2. Banco MySQL 8 com usuário exclusivo e TLS quando o provedor oferecer.
3. Bucket S3 compatível, privado, com versionamento e criptografia habilitados.
4. HTTPS no domínio e proxy encaminhando `X-Forwarded-For` e `X-Forwarded-Proto`.
5. Backup diário do banco e política de retenção/versionamento do bucket.

## Variáveis

Use `.env.example` como contrato. Configure segredos no painel do provedor, nunca no Git. Em produção, os valores mínimos são `NODE_ENV=production`, `DB_DIALECT=mysql`, `DATABASE_URL`, `STORAGE_DRIVER=s3`, credenciais S3, `COOKIE_SECURE=true`, `TRUST_PROXY=true` e a conta bootstrap.

Depois que o primeiro administrador for criado, remova `BOOTSTRAP_ADMIN_PASSWORD` do ambiente. A rotina bootstrap não altera usuários existentes.

## Ordem de implantação

1. Criar banco, usuário e política de backup.
2. Criar bucket privado, CORS fechado e credencial limitada ao bucket.
3. Configurar variáveis no serviço Node.
4. Executar `npm ci --omit=dev`.
5. Executar `npm run migrate`.
6. Iniciar com `npm start`.
7. Verificar `/api/health`, login, upload, consulta em uma segunda sessão, download e auditoria.
8. Fazer teste de restauração antes de inserir documentos reais.

## Migração do protótipo anterior

Registros que apareciam somente em um navegador não contêm o arquivo original no servidor. O ZIP “JUNTADA RUSTK BATERIAS.zip” precisa ser selecionado novamente no computador que ainda possui o original. Não há como recuperar o conteúdo do `localStorage`, porque ele guardava somente metadados como nome, tamanho e data.

## Critérios mínimos de aceite

- o mesmo arquivo aparece em duas sessões autenticadas autorizadas;
- o arquivo não aparece ao consultar outro tenant;
- download retorna exatamente o SHA-256 registrado;
- usuário sem vínculo recebe HTTP 403;
- exclusão deixa evento de auditoria e remove o item das consultas ativas;
- conflito de edição simultânea retorna HTTP 409;
- reinício e nova implantação não apagam banco nem objetos;
- restauração de backup é comprovada em ambiente separado.
