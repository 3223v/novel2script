/**
 * 默认小说结构化策略
 *
 * 从 Novel 基本信息构建一个最小化的 NormalizedNovel。
 * 不做深度分析，只填充可用的元数据。
 * 用于快速初始化或作为其他策略的 fallback。
 */

import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character, Chapter, Scene } from '@/lib/types';

export class DefaultNovelStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'default';
  readonly description = '默认结构化策略 — 仅从小说元数据构建基础 JSON，不做深度文本分析';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;

    onProgress?.('start', '开始构建基础结构化数据...');

    // Step 1: 构建元数据
    onProgress?.('metadata', '填充元数据...');
    const metadata: NormalizedNovel['metadata'] = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: rawText ? rawText.replace(/\s/g, '').length : 0,
      analysis_date: Date.now(),
    };

    // Step 2: 构建章节骨架 (如果有原始文本)
    onProgress?.('chapters', '检测章节结构...');
    const chapters = this.detectChapters(rawText);

    // Step 3: 从源文件名和基本信息推测角色
    onProgress?.('characters', '构建角色占位...');
    const characters: Character[] = [];

    // Step 4: 构建场景骨架
    onProgress?.('scenes', '构建场景骨架...');
    const scenes: Scene[] = chapters.map((ch, i) => ({
      chapter_index: ch.index,
      heading: ch.title,
      raw_text: rawText ? rawText.slice(0, 200) + '...' : '[待分析]',
      characters: [],
      locations: [],
    }));

    // Step 5: 情节摘要
    onProgress?.('summary', '生成情节摘要...');
    const plot_summary = novel.title
      ? `《${novel.title}》的情节摘要待分析生成。作者: ${novel.author || '未知'}。包含 ${chapters.length} 个章节。`
      : '情节摘要待分析生成。';

    onProgress?.('done', '基础结构化完成');

    return {
      metadata,
      characters,
      locations: [],
      plot_summary,
      chapters,
      scenes,
    };
  }

  /**
   * 从原始文本中检测章节结构。
   * 匹配模式: "第X章", "第X节", "Chapter X", 数字标题等
   */
  private detectChapters(rawText?: string): Chapter[] {
    if (!rawText) return [];

    const chapters: Chapter[] = [];
    const patterns = [
      /第([一二三四五六七八九十百千]+|\d+)[章节回]/g,
      /Chapter\s+\d+/gi,
      /^\d+[\.、\s]/gm,
    ];

    // 使用第一个匹配的模式
    for (const pattern of patterns) {
      const matches = rawText.match(pattern);
      if (matches && matches.length > 1) {
        matches.forEach((match, i) => {
          chapters.push({
            index: i,
            title: match,
            summary: `第 ${i + 1} 章节待分析`,
          });
        });
        break;
      }
    }

    // 如果没有检测到章节，创建一个默认章节
    if (chapters.length === 0) {
      chapters.push({
        index: 0,
        title: '全文',
        summary: '未检测到章节结构',
      });
    }

    return chapters;
  }
}
