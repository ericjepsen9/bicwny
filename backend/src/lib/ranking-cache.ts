// 排行缓存隐私版本号（审计 S5）
//
// 三个排行各自有 5min in-memory cache（key = classId:period…）· 缓存只按 class+period 分键 ·
// 用户切换班级可见性后 · 旧缓存仍会让其露出最长 5 分钟（隐私泄漏窗口）。
//
// 方案：所有 cache key 前缀此版本号 · 任一用户 toggle 可见性即 bump ·
//   bump 后旧 key 不再被命中（自然失效）· 旧 entry 由各自 TTL 回收。
//   全局粒度（非按 class）· 实现最简 · 排行查询本身廉价（groupBy）· 偶发全量重算可接受。
let privacyVersion = 0;

export function bumpRankingPrivacyVersion(): void {
  privacyVersion++;
}

export function rankingPrivacyVersion(): number {
  return privacyVersion;
}
