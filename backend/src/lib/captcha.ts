// CAPTCHA 验证 · 多 provider 抽象
//   CAPTCHA_PROVIDER=none → 直接通过 · 本地 dev / 未配置环境
//   turnstile / hcaptcha / recaptcha → 调对应 verify 端点
//
// 调用：await verifyCaptcha(token, ip)  // 失败 throw BadRequest
//
// 路由示例：
//   const t = (req.body as any)?.captchaToken;
//   await verifyCaptcha(t, req.ip);
import { config } from './config.js';
import { BadRequest, Internal } from './errors.js';

interface VerifyResp { success: boolean; reason?: string }

const VERIFY_ENDPOINTS = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
} as const;

export function isCaptchaEnabled(): boolean {
  return config.CAPTCHA_PROVIDER !== 'none' && !!config.CAPTCHA_SECRET_KEY;
}

/**
 * 校验客户端 captcha token · 失败抛 BadRequest
 * 没配置 provider 时直接通过 · 不阻塞 dev
 * 网络故障 fail-open 还是 fail-close？
 *   注册流量小 · 选 fail-close（500）防滥用 · 用户重试一次就过
 */
export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<void> {
  if (!isCaptchaEnabled()) return;
  if (!token) throw BadRequest('请先完成人机验证', { field: 'captchaToken' });

  const url = VERIFY_ENDPOINTS[config.CAPTCHA_PROVIDER as keyof typeof VERIFY_ENDPOINTS];
  if (!url) throw Internal('CAPTCHA_PROVIDER 配置不合法');

  const params = new URLSearchParams();
  params.set('secret', config.CAPTCHA_SECRET_KEY || '');
  params.set('response', token);
  if (ip) params.set('remoteip', ip);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    // 网络故障 · fail-close · 让用户重试
    throw Internal('人机验证服务暂时不可用 · 请稍后再试');
  }
  if (!resp.ok) {
    throw Internal('人机验证服务异常 · 请稍后再试');
  }
  const data = (await resp.json()) as VerifyResp & { 'error-codes'?: string[] };
  if (!data.success) {
    const reason = data['error-codes']?.join(',') || data.reason || 'invalid';
    throw BadRequest('人机验证未通过 · 请重试', { reason });
  }
}
