import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { extname, join } from "node:path";
import { audit, createDatabase } from "./database.mjs";
import { loadConfig } from "./config.mjs";
import { hashPassword, hashToken, newId, newSessionToken, sha256, verifyPassword } from "./security.mjs";
import { createStorage } from "./storage.mjs";

const COOKIE = 'd360_session';
const now = () => new Date().toISOString();
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const safeJson = (value, fallback = {}) => { try { return JSON.parse(value); } catch { return fallback; } };
const cleanFilename = (name) => String(name || 'arquivo').replace(/[\r\n"\\/]/g, '_').slice(0, 240);

export async function buildServer(options = {}) {
  const config = options.config || loadConfig();
  const db = options.db || await createDatabase(config);
  const storage = options.storage || createStorage(config);
  await storage.initialize?.();
  const app = Fastify({ logger: true, trustProxy: config.trustProxy, bodyLimit: config.maxUploadBytes + 1024 * 1024 });
  app.decorate('db', db);
  app.decorate('storage', storage);
  app.decorate('config', config);

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 20, fields: 20 } });
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } } });

  app.addHook('onClose', async () => { if (!options.db) await db.destroy(); });
  app.addHook('preHandler', async (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const site = request.headers['sec-fetch-site'];
      if (site && !['same-origin', 'none'].includes(site)) throw httpError(403, 'Origem da requisição não autorizada.');
    }
  });

  async function authenticate(request) {
    const token = request.cookies[COOKIE];
    if (!token) throw httpError(401, 'Autenticação necessária.');
    const row = await db.selectFrom('sessions').innerJoin('users', 'users.id', 'sessions.user_id')
      .select(['users.id', 'users.name', 'users.email', 'users.is_platform_admin', 'users.must_change_password', 'users.active', 'sessions.expires_at'])
      .where('sessions.token_hash', '=', hashToken(token)).executeTakeFirst();
    if (!row || !Number(row.active) || row.expires_at <= now()) throw httpError(401, 'Sessão inválida ou expirada.');
    request.user = { id: row.id, name: row.name, email: row.email, isPlatformAdmin: Boolean(row.is_platform_admin), mustChangePassword: Boolean(row.must_change_password) };
    return request.user;
  }

  async function allowedTenants(user) {
    if (user.isPlatformAdmin) return db.selectFrom('tenants').select(['id', 'name']).orderBy('name').execute();
    return db.selectFrom('memberships').innerJoin('tenants', 'tenants.id', 'memberships.tenant_id')
      .select(['tenants.id', 'tenants.name', 'memberships.role']).where('memberships.user_id', '=', user.id).orderBy('tenants.name').execute();
  }

  async function authorizeTenant(request) {
    const user = request.user || await authenticate(request);
    const tenantId = String(request.headers['x-tenant-id'] || request.query?.tenantId || request.body?.tenantId || '');
    if (!tenantId) throw httpError(400, 'Tenant não informado.');
    if (!user.isPlatformAdmin) {
      const membership = await db.selectFrom('memberships').select('role').where('user_id', '=', user.id).where('tenant_id', '=', tenantId).executeTakeFirst();
      if (!membership) throw httpError(403, 'Acesso negado a este tenant.');
      request.membershipRole = membership.role;
    } else request.membershipRole = 'platform_admin';
    request.tenantId = tenantId;
    return tenantId;
  }

  function requireManager(request) {
    if (!['owner', 'admin', 'platform_admin'].includes(request.membershipRole)) throw httpError(403, 'Operação restrita a administradores.');
  }

  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || (error.code === 'FST_REQ_FILE_TOO_LARGE' ? 413 : 500);
    if (status >= 500) request.log.error(error);
    else if (status !== 401) request.log.warn({ status, message: error.message });
    reply.code(status).send({ error: status >= 500 ? 'Erro interno do servidor.' : error.message });
  });

  app.get('/api/health', async () => ({ ok: true, version: '2.0.0', database: config.dbDialect, storage: config.storageDriver }));

  app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    if (!user || !Number(user.active) || !await verifyPassword(password, user.password_hash)) throw httpError(401, 'E-mail ou senha inválidos.');
    const token = newSessionToken(), createdAt = now(), expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600000).toISOString();
    await db.insertInto('sessions').values({ token_hash: hashToken(token), user_id: user.id, expires_at: expiresAt, created_at: createdAt }).execute();
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, maxAge: config.sessionTtlHours * 3600 });
    return { user: { id: user.id, name: user.name, email: user.email, isPlatformAdmin: Boolean(user.is_platform_admin), mustChangePassword: Boolean(user.must_change_password) } };
  });

  app.post('/api/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const token = request.cookies[COOKIE];
    await db.deleteFrom('sessions').where('token_hash', '=', hashToken(token)).execute();
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.post('/api/auth/change-password', { preHandler: authenticate }, async (request) => {
    const currentPassword = String(request.body?.currentPassword || '');
    const newPassword = String(request.body?.newPassword || '');
    const row = await db.selectFrom('users').select(['password_hash']).where('id', '=', request.user.id).executeTakeFirstOrThrow();
    if (!await verifyPassword(currentPassword, row.password_hash)) throw httpError(401, 'Senha atual inválida.');
    const passwordHash = await hashPassword(newPassword);
    await db.transaction().execute(async (trx) => {
      await trx.updateTable('users').set({ password_hash: passwordHash, must_change_password: 0 }).where('id', '=', request.user.id).execute();
      await trx.deleteFrom('sessions').where('user_id', '=', request.user.id).execute();
    });
    return { ok: true, loginRequired: true };
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => ({ user: request.user, tenants: await allowedTenants(request.user) }));

  app.get('/api/bootstrap', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const tenantId = request.tenantId;
    const organizations = await db.selectFrom('organizations').selectAll().where('tenant_id', '=', tenantId).orderBy('name').execute();
    const projects = await db.selectFrom('projects').selectAll().where('tenant_id', '=', tenantId).orderBy('updated_at', 'desc').execute();
    return { user: request.user, tenants: await allowedTenants(request.user), tenantId, organizations: organizations.map(mapOrganization), projects: projects.map(mapProject) };
  });

  app.post('/api/tenants', { preHandler: authenticate }, async (request) => {
    if (!request.user.isPlatformAdmin) throw httpError(403, 'Operação restrita ao administrador da plataforma.');
    const name = String(request.body?.name || '').trim();
    if (name.length < 2) throw httpError(400, 'Nome do tenant inválido.');
    const tenant = { id: newId(), name, created_at: now() };
    await db.insertInto('tenants').values(tenant).execute();
    return { id: tenant.id, name: tenant.name };
  });

  app.get('/api/users', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const rows = await db.selectFrom('memberships').innerJoin('users', 'users.id', 'memberships.user_id')
      .select(['users.id', 'users.name', 'users.email', 'users.active', 'users.must_change_password', 'memberships.role'])
      .where('memberships.tenant_id', '=', request.tenantId).orderBy('users.name').execute();
    return { users: rows.map((row) => ({ id: row.id, name: row.name, email: row.email, active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password), role: row.role })) };
  });

  app.post('/api/users', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const name = String(request.body?.name || '').trim(), email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || ''), role = String(request.body?.role || 'member');
    if (name.length < 2 || !email.includes('@')) throw httpError(400, 'Nome ou e-mail inválido.');
    if (!['owner', 'admin', 'analyst', 'member'].includes(role)) throw httpError(400, 'Perfil inválido.');
    if (await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()) throw httpError(409, 'Já existe um usuário com este e-mail.');
    const id = newId(), timestamp = now();
    await db.transaction().execute(async (trx) => {
      await trx.insertInto('users').values({ id, name, email, password_hash: await hashPassword(password), is_platform_admin: 0, must_change_password: 1, active: 1, created_at: timestamp }).execute();
      await trx.insertInto('memberships').values({ user_id: id, tenant_id: request.tenantId, role }).execute();
    });
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'user.created', entityType: 'user', entityId: id, details: { name, email, role }, ip: request.ip });
    return { id, name, email, role, mustChangePassword: true };
  });

  app.post('/api/organizations', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const name = String(request.body?.name || '').trim();
    if (name.length < 2) throw httpError(400, 'Nome da organização inválido.');
    const timestamp = now(), id = newId();
    await db.insertInto('organizations').values({ id, tenant_id: request.tenantId, name, cnpj: request.body?.cnpj || null, regime: request.body?.regime || null, city: request.body?.city || null, sector: request.body?.sector || null, created_at: timestamp, updated_at: timestamp }).execute();
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'organization.created', entityType: 'organization', entityId: id, details: { name }, ip: request.ip });
    return mapOrganization(await db.selectFrom('organizations').selectAll().where('id', '=', id).where('tenant_id', '=', request.tenantId).executeTakeFirstOrThrow());
  });

  app.patch('/api/organizations/:id', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const changes = pick(request.body, ['name', 'cnpj', 'regime', 'city', 'sector']);
    if (!Object.keys(changes).length) throw httpError(400, 'Nenhuma alteração informada.');
    changes.updated_at = now();
    const result = await db.updateTable('organizations').set(changes).where('id', '=', request.params.id).where('tenant_id', '=', request.tenantId).executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw httpError(404, 'Organização não encontrada.');
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'organization.updated', entityType: 'organization', entityId: request.params.id, details: changes, ip: request.ip });
    return { ok: true };
  });

  app.post('/api/projects', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const organization = await db.selectFrom('organizations').select('id').where('id', '=', request.body?.organizationId).where('tenant_id', '=', request.tenantId).executeTakeFirst();
    if (!organization) throw httpError(400, 'Organização inválida para este tenant.');
    const timestamp = now(), id = newId(), name = String(request.body?.name || '').trim();
    if (name.length < 2) throw httpError(400, 'Nome do projeto inválido.');
    await db.transaction().execute(async (trx) => {
      await trx.insertInto('projects').values({ id, tenant_id: request.tenantId, organization_id: organization.id, name, period: request.body?.period || null, status: request.body?.status || 'Coleta', scope: request.body?.scope || null, package_name: request.body?.package || 'A HOMOLOGAR', created_at: timestamp, updated_at: timestamp }).execute();
      await trx.insertInto('project_states').values({ project_id: id, tenant_id: request.tenantId, data_json: '{}', version: 1, updated_by: request.user.id, updated_at: timestamp }).execute();
    });
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'project.created', entityType: 'project', entityId: id, details: { name, organizationId: organization.id }, ip: request.ip });
    return mapProject(await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow());
  });

  app.get('/api/projects/:id/state', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const row = await db.selectFrom('project_states').selectAll().where('project_id', '=', request.params.id).where('tenant_id', '=', request.tenantId).executeTakeFirst();
    if (!row) throw httpError(404, 'Projeto não encontrado.');
    return { data: safeJson(row.data_json), version: row.version, updatedAt: row.updated_at };
  });

  app.put('/api/projects/:id/state', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const data = request.body?.data;
    const version = Number(request.body?.version);
    if (!data || typeof data !== 'object' || !Number.isInteger(version)) throw httpError(400, 'Estado ou versão inválidos.');
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized) > 5 * 1024 * 1024) throw httpError(413, 'Estado do projeto excede 5 MB.');
    const result = await db.updateTable('project_states').set({ data_json: serialized, version: version + 1, updated_by: request.user.id, updated_at: now() })
      .where('project_id', '=', request.params.id).where('tenant_id', '=', request.tenantId).where('version', '=', version).executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw httpError(409, 'Os dados foram alterados por outro usuário. Recarregue antes de salvar novamente.');
    return { ok: true, version: version + 1 };
  });

  app.get('/api/documents', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const { organizationId, projectId } = request.query || {};
    if (!organizationId || !projectId) throw httpError(400, 'Organização e projeto são obrigatórios.');
    const rows = await db.selectFrom('documents').selectAll().where('tenant_id', '=', request.tenantId).where('organization_id', '=', organizationId).where('project_id', '=', projectId).where('deleted_at', 'is', null).orderBy('created_at', 'desc').execute();
    return { documents: rows.map(mapDocument) };
  });

  app.post('/api/documents', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const fields = {}, files = [];
    for await (const part of request.parts()) {
      if (part.type === 'field') fields[part.fieldname] = String(part.value);
      else files.push({ name: cleanFilename(part.filename), type: part.mimetype || 'application/octet-stream', buffer: await part.toBuffer() });
    }
    if (!fields.organizationId || !fields.projectId || !files.length) throw httpError(400, 'Organização, projeto e arquivo são obrigatórios.');
    const project = await db.selectFrom('projects').select(['id', 'organization_id']).where('id', '=', fields.projectId).where('organization_id', '=', fields.organizationId).where('tenant_id', '=', request.tenantId).executeTakeFirst();
    if (!project) throw httpError(403, 'Projeto não pertence à organização e ao tenant informados.');
    const created = [];
    for (const file of files) {
      const id = newId(), extension = extname(file.name).replace(/[^.a-z0-9]/gi, '').slice(0, 12).toLowerCase();
      const key = `${request.tenantId}/${fields.organizationId}/${fields.projectId}/${id}${extension}`;
      const digest = sha256(file.buffer), timestamp = now();
      await storage.put(key, file.buffer, file.type);
      try {
        await db.insertInto('documents').values({ id, tenant_id: request.tenantId, organization_id: fields.organizationId, project_id: fields.projectId, original_name: file.name, content_type: file.type, size_bytes: file.buffer.length, sha256: digest, storage_key: key, status: 'Na fila', records: 0, created_by: request.user.id, created_at: timestamp, deleted_at: null }).execute();
      } catch (error) { await storage.delete(key).catch(() => {}); throw error; }
      await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'document.uploaded', entityType: 'document', entityId: id, details: { name: file.name, size: file.buffer.length, sha256: digest, organizationId: fields.organizationId, projectId: fields.projectId }, ip: request.ip });
      created.push(mapDocument(await db.selectFrom('documents').selectAll().where('id', '=', id).executeTakeFirstOrThrow()));
    }
    return { documents: created };
  });

  app.get('/api/documents/:id/download', { preHandler: [authenticate, authorizeTenant] }, async (request, reply) => {
    const file = await db.selectFrom('documents').selectAll().where('id', '=', request.params.id).where('tenant_id', '=', request.tenantId).where('deleted_at', 'is', null).executeTakeFirst();
    if (!file) throw httpError(404, 'Arquivo não encontrado.');
    const object = await storage.get(file.storage_key);
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'document.downloaded', entityType: 'document', entityId: file.id, details: { name: file.original_name }, ip: request.ip });
    reply.header('Content-Type', file.content_type).header('Content-Length', file.size_bytes).header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    return reply.send(object.body);
  });

  app.delete('/api/documents/:id', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    requireManager(request);
    const file = await db.selectFrom('documents').selectAll().where('id', '=', request.params.id).where('tenant_id', '=', request.tenantId).where('deleted_at', 'is', null).executeTakeFirst();
    if (!file) throw httpError(404, 'Arquivo não encontrado.');
    await db.updateTable('documents').set({ deleted_at: now(), status: 'Excluído' }).where('id', '=', file.id).where('tenant_id', '=', request.tenantId).execute();
    await audit(db, { tenantId: request.tenantId, userId: request.user.id, action: 'document.deleted', entityType: 'document', entityId: file.id, details: { name: file.original_name, retention: 'soft-delete' }, ip: request.ip });
    return { ok: true };
  });

  app.get('/api/audit', { preHandler: [authenticate, authorizeTenant] }, async (request) => {
    const rows = await db.selectFrom('audit_logs').innerJoin('users', 'users.id', 'audit_logs.user_id')
      .select(['audit_logs.id', 'audit_logs.action', 'audit_logs.entity_type', 'audit_logs.entity_id', 'audit_logs.details_json', 'audit_logs.ip', 'audit_logs.created_at', 'users.name as user_name'])
      .where('audit_logs.tenant_id', '=', request.tenantId).orderBy('audit_logs.created_at', 'desc').limit(500).execute();
    return { events: rows.map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: safeJson(row.details_json), ip: row.ip, createdAt: row.created_at, userName: row.user_name })) };
  });

  await app.register(fastifyStatic, { root: join(process.cwd(), 'dist'), prefix: '/', wildcard: false, cacheControl: false });
  app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: 'Endpoint não encontrado.' }) : reply.sendFile('index.html'));
  return app;
}

function pick(source = {}, allowed) { return Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])); }
function mapOrganization(row) { return { id: row.id, tenantId: row.tenant_id, name: row.name, cnpj: row.cnpj, regime: row.regime, city: row.city, sector: row.sector }; }
function mapProject(row) { return { id: row.id, tenantId: row.tenant_id, orgId: row.organization_id, name: row.name, period: row.period, status: row.status, scope: row.scope, package: row.package_name }; }
function mapDocument(row) { return { id: row.id, name: row.original_name, type: extname(row.original_name).slice(1).toUpperCase() || row.content_type, size: formatBytes(Number(row.size_bytes)), sizeBytes: Number(row.size_bytes), status: row.status, records: Number(row.records), integrity: `sha256:${row.sha256}`, sha256: row.sha256, at: new Date(row.created_at).toLocaleString('pt-BR'), createdAt: row.created_at }; }
function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 ** 2).toFixed(2)} MB`; }
