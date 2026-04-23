import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/modules/auth/tokens.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  await app.register(jwt, { secret: 'unit-test-secret-key' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('signAccessToken / verifyAccessToken', () => {
  it('签发后可验签并拿回 payload', () => {
    const token = signAccessToken(app, { sub: 'u1', role: 'admin' });
    const payload = verifyAccessToken(app, token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('admin');
    expect(payload.aud).toBe('access');
  });

  it('把 refresh token 传给 verifyAccess → 抛错', () => {
    const token = signRefreshToken(app, { sub: 'u1', sid: 's1' });
    expect(() => verifyAccessToken(app, token)).toThrow(/access token/);
  });

  it('无效字符串 → 抛错', () => {
    expect(() => verifyAccessToken(app, 'garbage')).toThrow();
    expect(() => verifyAccessToken(app, '')).toThrow();
  });
});

describe('signRefreshToken / verifyRefreshToken', () => {
  it('签发后可验签并拿回 payload（含 sid）', () => {
    const token = signRefreshToken(app, { sub: 'u1', sid: 's123' });
    const payload = verifyRefreshToken(app, token);
    expect(payload.sub).toBe('u1');
    expect(payload.sid).toBe('s123');
    expect(payload.aud).toBe('refresh');
  });

  it('把 access token 传给 verifyRefresh → 抛错', () => {
    const token = signAccessToken(app, { sub: 'u1', role: 'student' });
    expect(() => verifyRefreshToken(app, token)).toThrow(/refresh token/);
  });
});

describe('hashRefreshToken', () => {
  it('相同输入 → 相同输出（确定性）', () => {
    expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
  });

  it('不同输入 → 不同输出', () => {
    expect(hashRefreshToken('abc')).not.toBe(hashRefreshToken('abd'));
  });

  it('输出为 64 字符 hex（sha256）', () => {
    expect(hashRefreshToken('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
