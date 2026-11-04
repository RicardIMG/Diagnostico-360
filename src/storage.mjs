import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutBucketVersioningCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function createStorage(config) {
  if (config.storageDriver === 's3') {
    const client = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: config.s3.forcePathStyle, credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
    return {
      async initialize() {
        try { await client.send(new HeadBucketCommand({ Bucket: config.s3.bucket })); }
        catch { await client.send(new CreateBucketCommand({ Bucket: config.s3.bucket })); }
        try { await client.send(new PutBucketVersioningCommand({ Bucket: config.s3.bucket, VersioningConfiguration: { Status: 'Enabled' } })); }
        catch { /* Alguns provedores S3 compatíveis não implementam versionamento. */ }
      },
      async put(key, body, contentType) { await client.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' })); },
      async get(key) { const response = await client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })); return { body: response.Body, contentType: response.ContentType }; },
      async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })); },
    };
  }
  return {
    async initialize() { await mkdir(config.localStoragePath, { recursive: true }); },
    async put(key, body) { const path = join(config.localStoragePath, key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, body, { flag: 'wx' }); },
    async get(key) { return { body: await readFile(join(config.localStoragePath, key)) }; },
    async delete(key) { await rm(join(config.localStoragePath, key), { force: true }); },
  };
}
