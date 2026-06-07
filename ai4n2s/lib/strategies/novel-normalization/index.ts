/**
 * 小说结构化策略集合 — 注册入口
 *
 * 在此文件导入并注册所有可用的策略。
 * 新增策略时: 实现 NovelStructuringStrategy 接口 → 导入 → register。
 */

import { registerNovelStructuringStrategy } from '@/lib/pipeline/types';
import { DefaultNovelStructuringStrategy } from './default-strategy';
import { RegexNovelStructuringStrategy } from './regex-strategy';
import { AIStructuringStrategy } from './ai-strategy';

/** 保证策略已注册 (幂等) */
let initialized = false;

export function ensureStrategiesRegistered(): void {
  if (initialized) return;

  registerNovelStructuringStrategy(new DefaultNovelStructuringStrategy());
  registerNovelStructuringStrategy(new RegexNovelStructuringStrategy());
  registerNovelStructuringStrategy(new AIStructuringStrategy());

  initialized = true;
}

export { DefaultNovelStructuringStrategy } from './default-strategy';
export { RegexNovelStructuringStrategy } from './regex-strategy';
export { AIStructuringStrategy } from './ai-strategy';
