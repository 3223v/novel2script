/**
 * 剧本生成策略集合 — 注册入口
 *
 * 在此文件导入并注册所有可用的策略。
 * 新增策略时: 实现 ScriptGenerationStrategy 接口 → 导入 → register。
 */

import { registerScriptGenerationStrategy } from '@/lib/pipeline/types';
import { DefaultScriptGenerationStrategy } from './default-strategy';
import { AIRAGScriptGenerationStrategy } from './ai-rag-strategy';
import { LLMScriptGenerationStrategy } from './llm-strategy';

let initialized = false;

export function ensureStrategiesRegistered(): void {
  if (initialized) return;

  registerScriptGenerationStrategy(new DefaultScriptGenerationStrategy());
  registerScriptGenerationStrategy(new AIRAGScriptGenerationStrategy());
  registerScriptGenerationStrategy(new LLMScriptGenerationStrategy());

  initialized = true;
}

export { DefaultScriptGenerationStrategy } from './default-strategy';
export { AIRAGScriptGenerationStrategy } from './ai-rag-strategy';
export { LLMScriptGenerationStrategy } from './llm-strategy';
