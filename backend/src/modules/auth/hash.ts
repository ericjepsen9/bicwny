// 密码哈希：Node 内建 crypto.scrypt
// 零依赖、无原生编译，安全强度足以对抗离线爆破。
// 存储格式："<saltB64url>:<hashB64url>"
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { BadRequest } from '../../lib/errors.js';

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const MIN_PASSWORD_LEN = 6;

function scryptP(
  password: string,
  salt: Buffer,
  keylen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_OPTS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < MIN_PASSWORD_LEN) {
    throw BadRequest(`密码长度至少 ${MIN_PASSWORD_LEN} 位`);
  }
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptP(plain, salt, KEY_BYTES);
  return `${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  if (!plain || !stored) return false;
  const [saltStr, hashStr] = stored.split(':');
  if (!saltStr || !hashStr) return false;

  try {
    const salt = Buffer.from(saltStr, 'base64url');
    const expected = Buffer.from(hashStr, 'base64url');
    if (expected.length !== KEY_BYTES) return false;
    const derived = await scryptP(plain, salt, KEY_BYTES);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// 抹平登录路径"邮箱不存在 vs 密码错"的时间侧信道
// 模块首次需要时算一份 dummy hash · 之后所有路径走相同 scrypt 验证耗时
let dummyHashPromise: Promise<string> | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = (async () => {
      const salt = randomBytes(SALT_BYTES);
      const hash = await scryptP('__juexue_dummy_for_timing__', salt, KEY_BYTES);
      return `${salt.toString('base64url')}:${hash.toString('base64url')}`;
    })();
  }
  return dummyHashPromise;
}

/** 邮箱不存在时也跑一次 scrypt 验证 · 抹平响应时长差 · 防邮箱枚举侧信道 */
export async function verifyPasswordTimingSafe(plain: string): Promise<boolean> {
  const dummy = await getDummyHash();
  await verifyPassword(plain || '__no_password__', dummy);
  return false;
}
