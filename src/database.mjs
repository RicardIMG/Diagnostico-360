import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import mysql from "mysql2";
import { Kysely, MysqlDialect, SqliteDialect, sql } from "kysely";
import { hashPassword, newId } from "./security.mjs";

export async function createDatabase(config) {
  let dialect;
  if (config.dbDialect === 'mysql') {
    const url = new URL(config.databaseUrl);
    dialect = new MysqlDialect({ pool: mysql.createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectionLimit: 10, enableKeepAlive: true, charset: 'utf8mb4' }) });
  } else {
    await mkdir(dirname(config.sqlitePath), { recursive: true });
    const sqlite = new Database(config.sqlitePath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    dialect = new SqliteDialect({ database: sqlite });
  }
  const db = new Kysely({ dialect });
  await migrate(db);
  await bootstrap(db, config);
  return db;
}

async function createTableIfMissing(db, name, callback) {
  const tables = await db.introspection.getTables();
  if (!tables.some((table) => table.name === name)) await callback();
}

export async function migrate(db) {
  await createTableIfMissing(db, 'tenants', () => db.schema.createTable('tenants')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('name', 'varchar(200)', (c) => c.notNull()).addColumn('created_at', 'varchar(35)', (c) => c.notNull()).execute());
  await createTableIfMissing(db, 'users', () => db.schema.createTable('users')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('name', 'varchar(200)', (c) => c.notNull()).addColumn('email', 'varchar(320)', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull()).addColumn('is_platform_admin', 'integer', (c) => c.notNull().defaultTo(0)).addColumn('must_change_password', 'integer', (c) => c.notNull().defaultTo(1)).addColumn('active', 'integer', (c) => c.notNull().defaultTo(1)).addColumn('created_at', 'varchar(35)', (c) => c.notNull()).execute());
  const usersTable = (await db.introspection.getTables()).find((table) => table.name === 'users');
  if (usersTable && !usersTable.columns.some((column) => column.name === 'must_change_password')) await db.schema.alterTable('users').addColumn('must_change_password', 'integer', (c) => c.notNull().defaultTo(1)).execute();
  await createTableIfMissing(db, 'memberships', () => db.schema.createTable('memberships')
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull().references('users.id').onDelete('cascade')).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('role', 'varchar(30)', (c) => c.notNull()).addPrimaryKeyConstraint('memberships_pk', ['user_id', 'tenant_id']).execute());
  await createTableIfMissing(db, 'sessions', () => db.schema.createTable('sessions')
    .addColumn('token_hash', 'varchar(64)', (c) => c.primaryKey()).addColumn('user_id', 'varchar(36)', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('expires_at', 'varchar(35)', (c) => c.notNull()).addColumn('created_at', 'varchar(35)', (c) => c.notNull()).execute());
  await createTableIfMissing(db, 'organizations', () => db.schema.createTable('organizations')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('name', 'varchar(200)', (c) => c.notNull()).addColumn('cnpj', 'varchar(30)').addColumn('regime', 'varchar(100)').addColumn('city', 'varchar(150)').addColumn('sector', 'varchar(150)')
    .addColumn('created_at', 'varchar(35)', (c) => c.notNull()).addColumn('updated_at', 'varchar(35)', (c) => c.notNull()).execute());
  await createTableIfMissing(db, 'projects', () => db.schema.createTable('projects')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('organization_id', 'varchar(36)', (c) => c.notNull().references('organizations.id').onDelete('cascade')).addColumn('name', 'varchar(200)', (c) => c.notNull())
    .addColumn('period', 'varchar(100)').addColumn('status', 'varchar(50)', (c) => c.notNull()).addColumn('scope', 'text').addColumn('package_name', 'varchar(100)')
    .addColumn('created_at', 'varchar(35)', (c) => c.notNull()).addColumn('updated_at', 'varchar(35)', (c) => c.notNull()).execute());
  await createTableIfMissing(db, 'project_states', () => db.schema.createTable('project_states')
    .addColumn('project_id', 'varchar(36)', (c) => c.primaryKey().references('projects.id').onDelete('cascade')).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('data_json', 'text', (c) => c.notNull()).addColumn('version', 'integer', (c) => c.notNull().defaultTo(1)).addColumn('updated_by', 'varchar(36)', (c) => c.notNull().references('users.id')).addColumn('updated_at', 'varchar(35)', (c) => c.notNull()).execute());
  await createTableIfMissing(db, 'documents', () => db.schema.createTable('documents')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('organization_id', 'varchar(36)', (c) => c.notNull().references('organizations.id').onDelete('cascade')).addColumn('project_id', 'varchar(36)', (c) => c.notNull().references('projects.id').onDelete('cascade'))
    .addColumn('original_name', 'varchar(500)', (c) => c.notNull()).addColumn('content_type', 'varchar(200)', (c) => c.notNull()).addColumn('size_bytes', 'bigint', (c) => c.notNull())
    .addColumn('sha256', 'varchar(64)', (c) => c.notNull()).addColumn('storage_key', 'varchar(700)', (c) => c.notNull().unique()).addColumn('status', 'varchar(50)', (c) => c.notNull())
    .addColumn('records', 'integer', (c) => c.notNull().defaultTo(0)).addColumn('created_by', 'varchar(36)', (c) => c.notNull().references('users.id')).addColumn('created_at', 'varchar(35)', (c) => c.notNull()).addColumn('deleted_at', 'varchar(35)').execute());
  await createTableIfMissing(db, 'audit_logs', () => db.schema.createTable('audit_logs')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey()).addColumn('tenant_id', 'varchar(36)', (c) => c.notNull().references('tenants.id').onDelete('cascade'))
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull().references('users.id')).addColumn('action', 'varchar(100)', (c) => c.notNull()).addColumn('entity_type', 'varchar(100)', (c) => c.notNull())
    .addColumn('entity_id', 'varchar(36)', (c) => c.notNull()).addColumn('details_json', 'text', (c) => c.notNull()).addColumn('ip', 'varchar(80)').addColumn('created_at', 'varchar(35)', (c) => c.notNull()).execute());
  await db.schema.createIndex('documents_scope_idx').ifNotExists().on('documents').columns(['tenant_id', 'organization_id', 'project_id']).execute();
  await db.schema.createIndex('audit_scope_idx').ifNotExists().on('audit_logs').columns(['tenant_id', 'created_at']).execute();
}

async function bootstrap(db, config) {
  const countRow = await db.selectFrom('users').select(sql`count(*)`.as('count')).executeTakeFirst();
  if (Number(countRow?.count || 0) > 0) return;
  if (!config.bootstrap.adminPassword) throw new Error("Banco vazio: configure BOOTSTRAP_ADMIN_PASSWORD.");
  const now = new Date().toISOString(), tenantId = newId(), userId = newId();
  const passwordHash = await hashPassword(config.bootstrap.adminPassword);
  await db.transaction().execute(async (trx) => {
    await trx.insertInto('tenants').values({ id: tenantId, name: config.bootstrap.tenantName, created_at: now }).execute();
    await trx.insertInto('users').values({ id: userId, name: config.bootstrap.adminName, email: config.bootstrap.adminEmail, password_hash: passwordHash, is_platform_admin: 1, must_change_password: 0, active: 1, created_at: now }).execute();
    await trx.insertInto('memberships').values({ user_id: userId, tenant_id: tenantId, role: 'owner' }).execute();
    if (config.bootstrap.tenantUserEmail && config.bootstrap.tenantUserEmail !== config.bootstrap.adminEmail) {
      const tenantUserId = newId();
      await trx.insertInto('users').values({ id: tenantUserId, name: config.bootstrap.tenantUserName || config.bootstrap.tenantUserEmail, email: config.bootstrap.tenantUserEmail, password_hash: await hashPassword(config.bootstrap.tenantUserPassword), is_platform_admin: 0, must_change_password: 1, active: 1, created_at: now }).execute();
      await trx.insertInto('memberships').values({ user_id: tenantUserId, tenant_id: tenantId, role: 'owner' }).execute();
    }
  });
}

export async function audit(db, { tenantId, userId, action, entityType, entityId, details = {}, ip = null }) {
  await db.insertInto('audit_logs').values({ id: newId(), tenant_id: tenantId, user_id: userId, action, entity_type: entityType, entity_id: entityId, details_json: JSON.stringify(details), ip, created_at: new Date().toISOString() }).execute();
}
