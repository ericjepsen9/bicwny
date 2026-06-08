import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    // 集成测试共享一个 DB，必须串行跑避免 beforeEach resetDb 打架
    // 单元测试纯 in-memory，并发无碍；这里一刀切为串行成本可接受（~3 秒）
    fileParallelism: false,
  },
});
