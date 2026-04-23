import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/modules/auth/hash.js';

describe('hashPassword / verifyPassword', () => {
  it('同密码两次 hash 结果不同（salt 随机）', async () => {
    const a = await hashPassword('testpass');
    const b = await hashPassword('testpass');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/); // base64url
  });

  it('verify 正确密码 → true', async () => {
    const stored = await hashPassword('testpass');
    expect(await verifyPassword('testpass', stored)).toBe(true);
  });

  it('verify 错误密码 → false', async () => {
    const stored = await hashPassword('testpass');
    expect(await verifyPassword('wrongpass', stored)).toBe(false);
  });

  it('格式错误的 stored → false（不抛错）', async () => {
    expect(await verifyPassword('x', 'invalid')).toBe(false);
    expect(await verifyPassword('x', 'a:b')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('空密码 / 空 stored → false', async () => {
    const stored = await hashPassword('testpass');
    expect(await verifyPassword('', stored)).toBe(false);
    expect(await verifyPassword('testpass', '')).toBe(false);
  });

  it('密码 < 6 位抛错（BadRequest）', async () => {
    await expect(hashPassword('12345')).rejects.toThrow(/密码长度至少/);
    await expect(hashPassword('')).rejects.toThrow();
  });
});
