import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildServer } from "../src/server.mjs";

test("backend autentica, isola tenant e persiste arquivo com integridade", async () => {
  const root = await mkdtemp(join(tmpdir(), 'd360-test-'));
  const config = {
    production: false, dbDialect: 'sqlite', sqlitePath: join(root, 'test.sqlite'), storageDriver: 'local', localStoragePath: join(root, 'uploads'),
    maxUploadBytes: 1024 * 1024, cookieSecure: false, trustProxy: false, sessionTtlHours: 1,
    bootstrap: { tenantName: 'Tenant Teste', adminName: 'Admin Teste', adminEmail: 'admin@teste.local', adminPassword: 'senha-segura-teste' }, s3: {},
  };
  const app = await buildServer({ config });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'admin@teste.local', password: 'senha-segura-teste' } });
    assert.equal(login.statusCode, 200);
    const cookie = login.headers['set-cookie'].split(';')[0];

    const identity = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(identity.statusCode, 200);
    const tenantId = identity.json().tenants[0].id;

    const bootstrap = await app.inject({ method: 'GET', url: '/api/bootstrap', headers: { cookie, 'x-tenant-id': tenantId } });
    assert.equal(bootstrap.statusCode, 200);
    const organizationId = bootstrap.json().organizations[0].id;
    const projectId = bootstrap.json().projects[0].id;

    const state = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/state`, headers: { cookie, 'x-tenant-id': tenantId } });
    const firstSave = await app.inject({ method: 'PUT', url: `/api/projects/${projectId}/state`, headers: { cookie, 'x-tenant-id': tenantId }, payload: { data: { scenario: { revenue: 1000 } }, version: state.json().version } });
    assert.equal(firstSave.statusCode, 200);
    const staleSave = await app.inject({ method: 'PUT', url: `/api/projects/${projectId}/state`, headers: { cookie, 'x-tenant-id': tenantId }, payload: { data: { scenario: { revenue: 2000 } }, version: state.json().version } });
    assert.equal(staleSave.statusCode, 409);

    const boundary = '----diagnostico360test';
    const csv = 'documento,valor\nNF-001,100.00\n';
    const multipart = Buffer.from([
      `--${boundary}\r\nContent-Disposition: form-data; name="organizationId"\r\n\r\n${organizationId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n${projectId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="dados.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n`,
      `--${boundary}--\r\n`,
    ].join(''));
    const upload = await app.inject({ method: 'POST', url: '/api/documents', headers: { cookie, 'x-tenant-id': tenantId, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: multipart });
    assert.equal(upload.statusCode, 200, upload.body);
    assert.match(upload.json().documents[0].integrity, /^sha256:[a-f0-9]{64}$/);

    const inventory = await app.inject({ method: 'GET', url: `/api/documents?organizationId=${organizationId}&projectId=${projectId}`, headers: { cookie, 'x-tenant-id': tenantId } });
    assert.equal(inventory.statusCode, 200);
    assert.equal(inventory.json().documents[0].name, 'dados.csv');

    const secondTenant = await app.inject({ method: 'POST', url: '/api/tenants', headers: { cookie }, payload: { name: 'Tenant Isolado' } });
    const isolated = await app.inject({ method: 'GET', url: `/api/documents?organizationId=${organizationId}&projectId=${projectId}`, headers: { cookie, 'x-tenant-id': secondTenant.json().id } });
    assert.equal(isolated.statusCode, 200);
    assert.equal(isolated.json().documents.length, 0);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
