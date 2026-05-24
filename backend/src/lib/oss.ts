// 觉学 OSS · 媒体文件上传到独立 OSS 服务器
//
// 架构：
//   主 backend → ssh + scp → OSS 服务器（129.213.64.152）
//   OSS 服务器 nginx serve · 公开 URL https://media.juexue.caughtalert.com/...
//
// 用途：
//   - 观修视频 mp4
//   - 观修 PPT pdf
//   - 后续可扩展：班级封面、辅导员上传等
//
// 认证：
//   ssh key based · 主 backend ~/.ssh/juexue-oss · 已 ssh-copy-id 到 OSS
//
// 失败处理：
//   - scp 失败 throw · 调用方自己处理（一般 admin 重传）
//   - 删除失败静默吞（best-effort · 文件孤儿不致命）

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const OSS_HOST = process.env.OSS_HOST;
const OSS_SSH_KEY = process.env.OSS_SSH_KEY;
const OSS_REMOTE_DIR = process.env.OSS_REMOTE_DIR;
const OSS_PUBLIC_URL = process.env.OSS_PUBLIC_URL;

function assertOssConfigured(): void {
  if (!OSS_HOST || !OSS_SSH_KEY || !OSS_REMOTE_DIR || !OSS_PUBLIC_URL) {
    throw new Error(
      'OSS not configured. Required env: OSS_HOST, OSS_SSH_KEY, OSS_REMOTE_DIR, OSS_PUBLIC_URL',
    );
  }
}

const SSH_OPTS = [
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'BatchMode=yes',                       // 不交互（密码 prompt 时立即 fail · 不挂死）
  '-o', 'ConnectTimeout=10',
];

/**
 * 上传本地文件到 OSS
 *
 * @param localPath  本地绝对路径（如 /tmp/abc.mp4）
 * @param ossKey     OSS 内部相对路径（如 'meditations/videos/abc.mp4'）
 * @returns          公开访问 URL
 */
export async function uploadToOss(localPath: string, ossKey: string): Promise<string> {
  assertOssConfigured();

  // 防路径穿越 · ossKey 不允许 ../ 或绝对路径
  if (ossKey.includes('..') || path.isAbsolute(ossKey)) {
    throw new Error(`Invalid ossKey: ${ossKey}`);
  }

  const remotePath = `${OSS_REMOTE_DIR}/${ossKey}`;
  const remoteDir = path.posix.dirname(remotePath);

  // 1. 确保远程目录存在（mkdir -p · 已存在不报错）
  await execFileAsync('ssh', [
    '-i', OSS_SSH_KEY!,
    ...SSH_OPTS,
    OSS_HOST!,
    `mkdir -p ${remoteDir}`,
  ]);

  // 2. scp 上传
  await execFileAsync('scp', [
    '-i', OSS_SSH_KEY!,
    ...SSH_OPTS,
    localPath,
    `${OSS_HOST}:${remotePath}`,
  ], {
    // scp 大文件可能超过默认 maxBuffer · 给足空间（默认 1MB stdout buffer）
    maxBuffer: 100 * 1024 * 1024,
  });

  return `${OSS_PUBLIC_URL}/${ossKey}`;
}

/**
 * 从 OSS 删除文件（best-effort · 失败静默）
 */
export async function deleteFromOss(ossKey: string): Promise<void> {
  if (!OSS_HOST || !OSS_SSH_KEY || !OSS_REMOTE_DIR) return;
  if (ossKey.includes('..') || path.isAbsolute(ossKey)) return;

  const remotePath = `${OSS_REMOTE_DIR}/${ossKey}`;

  try {
    await execFileAsync('ssh', [
      '-i', OSS_SSH_KEY,
      ...SSH_OPTS,
      OSS_HOST,
      `rm -f ${remotePath}`,
    ]);
  } catch {
    // best-effort
  }
}

/**
 * 从 OSS URL 反推 ossKey（用于 deleteFromOss）
 *
 * 输入：'https://media.juexue.caughtalert.com/meditations/videos/abc.mp4'
 * 输出：'meditations/videos/abc.mp4'
 *
 * 不匹配时返回 null（可能是外链 / 旧数据 · 不动）
 */
export function ossKeyFromUrl(url: string | null | undefined): string | null {
  if (!url || !OSS_PUBLIC_URL) return null;
  if (!url.startsWith(OSS_PUBLIC_URL + '/')) return null;
  const key = url.slice(OSS_PUBLIC_URL.length + 1);
  if (key.includes('..') || key.startsWith('/')) return null;
  return key;
}
