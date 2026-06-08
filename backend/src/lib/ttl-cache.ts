// 自清理 TTL 内存缓存（审计 P9）
//   排行缓存 key 含 rankingPrivacyVersion · 任一用户切可见性即 bump · 旧版本 key 立刻不再命中。
//   旧实现用裸 Map · 过期 / 旧版本的死键永不删除 → 长寿单进程里无限堆积（内存泄漏）。
//   这里写时顺带清扫过期项（size 超阈值才扫 · 避免每次写遍历）· 上界 ≈ 活跃 key 数。
export class TtlCache<V> {
  private store = new Map<string, { data: V; expiresAt: number }>();
  constructor(private readonly ttlMs: number, private readonly pruneThreshold = 64) {}

  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.data;
  }

  set(key: string, data: V): void {
    if (this.store.size >= this.pruneThreshold) this.prune();
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
  }
}
