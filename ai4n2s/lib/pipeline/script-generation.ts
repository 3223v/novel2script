/**
 * 剧本生成管线 — NormalizedNovel → ScriptYAML
 *
 * 负责:
 *   1. 加载结构化小说数据
 *   2. 根据配置选择并执行剧本生成策略
 *   3. 将结果保存为 Script (通过 ScriptService)
 */

import type { Novel, NormalizedNovel, ScriptYAML } from '@/lib/types';
import type {
  GenerationResult,
  GenerationProgress,
} from '@/lib/pipeline/types';
import {
  scriptGenerationStrategies,
  getScriptGenerationStrategies,
} from '@/lib/pipeline/types';
import NovelStructuringPipeline from './novel-structuring';
import ScriptService from '@/lib/script-service';

// 确保策略已注册
import { ensureStrategiesRegistered as ensureScriptStrategies } from '@/lib/strategies/script-generation';
ensureScriptStrategies();

export class ScriptGenerationPipeline {
  /**
   * 执行剧本生成
   *
   * @param novel - 小说对象
   * @param version - 剧本版本号
   * @param strategyName - 策略名称 (default, ai-rag)
   * @param onProgress - 进度回调
   */
  static async execute(
    novel: Novel,
    version: string,
    strategyName: string = 'default',
    onProgress?: GenerationProgress
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. 选择策略
    const strategy = scriptGenerationStrategies.get(strategyName);
    if (!strategy) {
      const available = getScriptGenerationStrategies().map(s => s.name).join(', ');
      return {
        success: false,
        error: `未知策略 "${strategyName}"。可用策略: ${available}`,
        strategy: strategyName,
        duration: Date.now() - startTime,
      };
    }

    try {
      // 2. 加载结构化小说数据
      onProgress?.('load', '加载结构化小说数据...');
      let structuredNovel = NovelStructuringPipeline.loadNormalizedData(novel.id);

      if (!structuredNovel) {
        // 如果没有结构化数据，先用默认策略生成一份
        onProgress?.('structure', '未找到结构化数据，先执行基础结构化...');
        const structResult = await NovelStructuringPipeline.execute(
          novel,
          'default',
          (stage, detail) => onProgress?.(`structure:${stage}`, detail)
        );

        if (!structResult.success || !structResult.data) {
          return {
            success: false,
            error: `无法获取结构化小说数据: ${structResult.error}`,
            strategy: strategy.name,
            duration: Date.now() - startTime,
          };
        }

        structuredNovel = structResult.data;
      }

      // 3. 执行策略
      onProgress?.('execute', `执行策略: ${strategy.name}`);
      const scriptData = await strategy.execute(
        { novel, structuredNovel, version },
        onProgress
      );

      // 4. 保存剧本
      onProgress?.('save', '保存剧本...');
      const scriptResult = ScriptService.create(novel.id, version, scriptData);

      if (!scriptResult.success) {
        return {
          success: false,
          error: `保存剧本失败: ${scriptResult.error}`,
          strategy: strategy.name,
          duration: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: scriptData,
        strategy: strategy.name,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        strategy: strategy.name,
        duration: Date.now() - startTime,
      };
    }
  }
}

export default ScriptGenerationPipeline;
