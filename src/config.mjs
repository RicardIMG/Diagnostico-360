import { resolve } from "node:path";

function bool(name, fallback = false) {
  const value = process.env[name];
  return value == null ? fallback : /^(1|true|yes|sim)$/i.test(value);
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} precisa ser um número positivo.`);
  return value;
}

export function loadConfig() {
  const production = process.env.NODE_ENV === "production";
  const dbDialect = (process.env.DB_DIALECT || "sqlite").toLowerCase();
  const storageDriver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (!['sqlite', 'mysql'].includes(dbDialect)) throw new Error("DB_DIALECT deve ser sqlite ou mysql.");
  if (!['local', 's3'].includes(storageDriver)) throw new Error("STORAGE_DRIVER deve ser local ou s3.");
  if (production && dbDialect === 'sqlite') throw new Error("Produção exige DB_DIALECT=mysql para persistência compartilhada.");
  if (production && storageDriver === 'local') throw new Error("Produção exige STORAGE_DRIVER=s3 para preservar arquivos entre implantações.");

  const config = {
    production, dbDialect, databaseUrl: process.env.DATABASE_URL,
    sqlitePath: resolve(process.env.SQLITE_PATH || "./data/diagnostico360.sqlite"),
    storageDriver, localStoragePath: resolve(process.env.LOCAL_STORAGE_PATH || "./data/uploads"),
    maxUploadBytes: positiveNumber("MAX_UPLOAD_MB", 100) * 1024 * 1024,
    cookieSecure: bool("COOKIE_SECURE", production), trustProxy: bool("TRUST_PROXY", production),
    sessionTtlHours: positiveNumber("SESSION_TTL_HOURS", 12),
    bootstrap: {
      tenantName: process.env.BOOTSTRAP_TENANT_NAME || "Diagnóstico 360",
      adminName: process.env.BOOTSTRAP_ADMIN_NAME || "Administrador",
      adminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@diagnostico360.local").toLowerCase(),
      adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || (production ? "" : "troque-esta-senha"),
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: bool("S3_FORCE_PATH_STYLE", false),
    },
  };
  if (dbDialect === 'mysql' && !config.databaseUrl) throw new Error("DATABASE_URL é obrigatória para MySQL.");
  if (storageDriver === 's3' && (!config.s3.bucket || !config.s3.accessKeyId || !config.s3.secretAccessKey)) throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY são obrigatórias para S3.");
  if (production && !config.bootstrap.adminPassword) throw new Error("BOOTSTRAP_ADMIN_PASSWORD é obrigatória na primeira implantação.");
  return config;
}
