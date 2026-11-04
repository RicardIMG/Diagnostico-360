import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${Buffer.from(derived).toString('base64')}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, salt64, hash64] = encoded.split('$');
    if (algorithm !== 'scrypt') return false;
    const expected = Buffer.from(hash64, 'base64');
    const actual = Buffer.from(await scrypt(password, Buffer.from(salt64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) }));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

export function newId() { return randomUUID(); }
export function newSessionToken() { return randomBytes(32).toString('base64url'); }
export function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
export function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
