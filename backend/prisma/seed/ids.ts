// 共享 ID 常量：所有 seed 子模块统一引用，避免字符串散落
export const DEV_USER_ID = 'dev_user_001';

export const COURSE_ID = 'course_ruxinglun';

export const CHAPTERS = {
  ch01: 'ch_ruxinglun_01',
  ch03: 'ch_ruxinglun_03',
} as const;

export const LESSONS = {
  l01_01: 'lesson_ruxinglun_01_01',
  l01_02: 'lesson_ruxinglun_01_02',
  l01_03: 'lesson_ruxinglun_01_03',
  l03_01: 'lesson_ruxinglun_03_01',
  l03_02: 'lesson_ruxinglun_03_02',
} as const;

export const PROVIDER_IDS = {
  minimax: 'provider_minimax',
  claude: 'provider_claude',
} as const;

export const SCENARIO_ID = 'scenario_open_grading';
export const PROMPT_TEMPLATE_ID = 'prompt_open_grading_v3_1';
