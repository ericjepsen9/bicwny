// 起点 seed · 给已存在的 Course 行写一条 ContentRelease(create) 作为基线
// 这条 seed 不修改任何业务数据 · 只是把"v1.0 上线时已有的内容"记入 release 流水
//
// 后续 seed 文件按命名规约 V<yyyymm>_<slug>.ts · runner 按文件名升序应用
import type { SeedDef } from '../../../src/lib/content-seed.js';

const seed: SeedDef = {
  name: 'V202604_init',
  async run(tx, ctx) {
    const courses = await tx.course.findMany({ select: { id: true, contentVersion: true } });
    for (const c of courses) {
      // baseline: 仅当还没有 release 行时记一条 · 重复运行时 cohortCount=0 跳过
      const hasRow = await tx.contentRelease.findFirst({
        where: { entity: 'course', entityId: c.id },
      });
      if (hasRow) continue;
      await ctx.record('course', c.id, 'create', null, c.contentVersion, { baseline: true });
    }
    return { courses: courses.length };
  },
};

export default seed;
