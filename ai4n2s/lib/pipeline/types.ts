/**
 * Pipeline types — 小说处理管线核心类型定义
 *
 * 两条管线:
 *   1. Novel → NormalizedNovel  (小说对象 → 结构化小说)
 *   2. NormalizedNovel → ScriptYAML  (结构化小说 → 剧本)
 */

import type { Novel, NormalizedNovel, ScriptYAML } from '@/lib/types';

// ══════════════════════════════════════════════════════
// Pipeline 1: Novel → NormalizedNovel
// ══════════════════════════════════════════════════════

/** 小说结构化策略的输入 */
export interface NovelStructuringInput {
  /** 小说基础信息 */
  novel: Novel;
  /** 从源文件中提取的原始文本 (可选) */
  rawText?: string;
  /** 策略特定的配置 */
  config?: Record<string, unknown>;
}

/** 小说结构化策略的进度回调 */
export type StructuringProgress = (stage: string, detail: string) => void;

/** 小说结构化策略接口 — 策略模式的核心抽象 */
export interface NovelStructuringStrategy {
  /** 策略唯一标识 */
  readonly name: string;
  /** 策略描述 */
  readonly description: string;
  /** 执行结构化 */
  execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel>;
}

/** 小说结构化结果 */
export interface StructuringResult {
  success: boolean;
  data?: NormalizedNovel;
  error?: string;
  /** 使用的策略名称 */
  strategy: string;
  /** 处理耗时 (ms) */
  duration: number;
}

// ══════════════════════════════════════════════════════
// Pipeline 2: NormalizedNovel → ScriptYAML
// ══════════════════════════════════════════════════════

/** 剧本生成策略的输入 */
export interface ScriptGenerationInput {
  /** 小说基础信息 */
  novel: Novel;
  /** 结构化后的小说数据 */
  structuredNovel: NormalizedNovel;
  /** 目标版本标识 */
  version: string;
  /** 策略特定的配置 */
  config?: Record<string, unknown>;
}

/** 剧本生成策略的进度回调 */
export type GenerationProgress = (stage: string, detail: string) => void;

/** 剧本生成策略接口 — 策略模式的核心抽象 */
export interface ScriptGenerationStrategy {
  /** 策略唯一标识 */
  readonly name: string;
  /** 策略描述 */
  readonly description: string;
  /** 执行剧本生成 */
  execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML>;
}

/** 剧本生成结果 */
export interface GenerationResult {
  success: boolean;
  data?: ScriptYAML;
  error?: string;
  /** 使用的策略名称 */
  strategy: string;
  /** 处理耗时 (ms) */
  duration: number;
}

// ══════════════════════════════════════════════════════
// Pipeline 注册表
// ══════════════════════════════════════════════════════

/** 小说结构化策略注册表 */
export const novelStructuringStrategies = new Map<string, NovelStructuringStrategy>();

/** 剧本生成策略注册表 */
export const scriptGenerationStrategies = new Map<string, ScriptGenerationStrategy>();

/** 注册小说结构化策略 */
export function registerNovelStructuringStrategy(strategy: NovelStructuringStrategy): void {
  novelStructuringStrategies.set(strategy.name, strategy);
}

/** 注册剧本生成策略 */
export function registerScriptGenerationStrategy(strategy: ScriptGenerationStrategy): void {
  scriptGenerationStrategies.set(strategy.name, strategy);
}

/** 获取所有已注册的小说结构化策略 */
export function getNovelStructuringStrategies(): NovelStructuringStrategy[] {
  return Array.from(novelStructuringStrategies.values());
}

/** 获取所有已注册的剧本生成策略 */
export function getScriptGenerationStrategies(): ScriptGenerationStrategy[] {
  return Array.from(scriptGenerationStrategies.values());
}
