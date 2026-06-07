/**
 * 小说结构化管线 — Novel → NormalizedNovel
 *
 * 负责:
 *   1. 从小说源文件中提取原始文本
 *   2. 根据配置选择并执行结构化策略
 *   3. 将结果保存为 JSON 文件并更新数据库
 */

import fs from 'fs';
import path from 'path';
import type { Novel, NormalizedNovel } from '@/lib/types';
import type {
  StructuringResult,
  StructuringProgress,
} from '@/lib/pipeline/types';
import {
  novelStructuringStrategies,
  getNovelStructuringStrategies,
} from '@/lib/pipeline/types';
import { fileProcessor } from '@/lib/modules/file-processor';
import NovelService from '@/lib/novel-service';

// 确保策略已注册
import { ensureStrategiesRegistered as ensureNovelStrategies } from '@/lib/strategies/novel-normalization';
ensureNovelStrategies();

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

export class NovelStructuringPipeline {
  /**
   * 执行小说结构化
   *
   * @param novel - 小说对象
   * @param strategyName - 策略名称 (default, regex, ai-workflow)
   * @param onProgress - 进度回调
   */
  static async execute(
    novel: Novel,
    strategyName: string = 'default',
    onProgress?: StructuringProgress
  ): Promise<StructuringResult> {
    const startTime = Date.now();

    // 1. 选择策略
    const strategy = novelStructuringStrategies.get(strategyName);
    if (!strategy) {
      const available = getNovelStructuringStrategies().map(s => s.name).join(', ');
      return {
        success: false,
        error: `未知策略 "${strategyName}"。可用策略: ${available}`,
        strategy: strategyName,
        duration: Date.now() - startTime,
      };
    }

    try {
      // 2. 提取原始文本 (从源文件)
      onProgress?.('extract', '从源文件提取文本...');
      const rawText = await this.extractRawText(novel);

      if (!rawText) {
        // 无文本可用 — 用空文本执行策略（策略会处理空文本）
        onProgress?.('extract', '无源文件文本，使用基础信息执行结构化...');
      }

      // 3. 执行策略
      onProgress?.('execute', `执行策略: ${strategy.name}`);
      const result = await strategy.execute(
        { novel, rawText: rawText || undefined },
        onProgress
      );

      // 4. 保存结果到文件
      onProgress?.('save', '保存结构化数据...');
      await this.saveNormalizedData(novel.id, result);

      // 5. 更新数据库状态
      onProgress?.('db', '更新数据库...');
      const normalizedPath = path.join(novel.id, 'normalized.json');
      NovelService.setNormalizedPath(novel.id, normalizedPath);

      return {
        success: true,
        data: result,
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

  /**
   * 从小说源文件中提取所有原始文本
   */
  static async extractRawText(novel: Novel): Promise<string | null> {
    const sourceFiles = novel.source_files || [];
    if (sourceFiles.length === 0) return null;

    const texts: string[] = [];

    for (const sf of sourceFiles) {
      try {
        const fullPath = path.join(STORAGE_DIR, novel.id, sf.path);
        if (fs.existsSync(fullPath)) {
          const result = await fileProcessor.extractFromFile(fullPath);
          if (result.text && !result.text.startsWith('[')) {
            texts.push(`--- ${sf.name} ---\n${result.text}`);
          }
        }
      } catch {
        // 跳过错文件
      }
    }

    return texts.length > 0 ? texts.join('\n\n') : null;
  }

  /**
   * 保存标准化数据到 JSON 文件
   */
  static async saveNormalizedData(
    novelId: string,
    data: NormalizedNovel
  ): Promise<string> {
    const novelDir = path.join(STORAGE_DIR, novelId);
    if (!fs.existsSync(novelDir)) {
      fs.mkdirSync(novelDir, { recursive: true });
    }

    const filePath = path.join(novelDir, 'normalized.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * 读取已保存的标准化数据
   */
  static loadNormalizedData(novelId: string): NormalizedNovel | null {
    const filePath = path.join(STORAGE_DIR, novelId, 'normalized.json');
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as NormalizedNovel;
    } catch {
      return null;
    }
  }

  /**
   * 获取配置文件路径
   */
  static getNormalizedPath(novelId: string): string {
    return path.join(STORAGE_DIR, novelId, 'normalized.json');
  }
}

export default NovelStructuringPipeline;
