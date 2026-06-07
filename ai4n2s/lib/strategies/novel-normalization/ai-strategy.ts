/**
 * 基于 AI 工作流的小说结构化策略
 *
 * 分步骤调用 LLM 完成:
 *   1. 章节切分与摘要
 *   2. 角色识别与关系分析
 *   3. 地点识别
 *   4. 场景切分与描述
 *   5. 情节摘要生成
 *
 * 每个步骤可独立调用 LLM，也可以合并为单次调用 (取决于文本长度)。
 * 当前为骨架实现，调用 Mock LLM 返回占位内容。
 */

import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character, Location, Chapter, Scene } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';
import { RAGFactory } from '@/lib/modules/rag';

// ── LLM Prompts ──

const SYSTEM_PROMPT = `你是一位专业的小说分析专家。你的任务是将小说文本结构化，提取:
- 章节结构 (章节标题、索引、摘要)
- 角色列表 (姓名、别名、描述、性格、角色定位)
- 地点列表 (名称、描述)
- 场景列表 (所在章节、场景标题、原文片段、出现角色、出现地点)
- 情节摘要

请以 JSON 格式返回结果。`;

export class AIStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'ai-workflow';
  readonly description = 'AI 工作流策略 — 使用 LLM 逐步分析小说文本，提取结构化信息';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;
    const text = rawText || '';

    onProgress?.('start', 'AI 分析开始...');

    // 如果文本太长，先建立 RAG 索引
    if (text.length > 5000) {
      onProgress?.('indexing', `文本较长 (${text.length} 字符)，建立 RAG 索引...`);
      await RAGFactory.indexDocument(novel.id, text, { chunkSize: 3000, overlap: 300 });
    }

    // 1. 元数据
    const metadata: NormalizedNovel['metadata'] = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: text.replace(/\s/g, '').length,
      analysis_date: Date.now(),
    };

    // 2. 章节检测 (优先用正则快速检测，AI 补充摘要)
    onProgress?.('chapters', 'AI 分析章节结构...');
    const chapters = await this.analyzeChapters(text, novel.title);

    // 3. 角色识别
    onProgress?.('characters', 'AI 识别角色...');
    const characters = await this.analyzeCharacters(text);

    // 4. 地点识别
    onProgress?.('locations', 'AI 识别地点...');
    const locations = await this.analyzeLocations(text);

    // 5. 场景切分
    onProgress?.('scenes', 'AI 切分场景...');
    const scenes = await this.analyzeScenes(text, chapters);

    // 6. 情节摘要
    onProgress?.('summary', 'AI 生成情节摘要...');
    const plot_summary = await this.generatePlotSummary(text, metadata, chapters, characters);

    onProgress?.('done', 'AI 分析完成');

    return {
      metadata,
      characters,
      locations,
      plot_summary,
      chapters,
      scenes,
    };
  }

  private async analyzeChapters(text: string, title: string): Promise<Chapter[]> {
    // 先用正则快速检测章节标题
    const chapterMatches = text.match(/(?:第[一二三四五六七八九十百千\d]+[章节回]|Chapter\s+\d+)/g) || [];
    if (chapterMatches.length === 0) {
      return [{ index: 0, title, summary: '全文（未检测到章节）' }];
    }

    // AI 为每个章节生成摘要
    const chapters: Chapter[] = [];
    for (let i = 0; i < chapterMatches.length; i++) {
      const chTitle = chapterMatches[i];
      const nextCh = chapterMatches[i + 1];
      const chStart = text.indexOf(chTitle);
      const chEnd = nextCh ? text.indexOf(nextCh, chStart + 1) : text.length;
      const chText = chStart >= 0 ? text.slice(chStart, Math.min(chStart + 2000, chEnd)) : '';

      let summary = '';
      try {
        const result = await LLMFactory.complete(
          `请用一句话概括以下章节的内容:\n\n${chText.slice(0, 1500)}`,
          { temperature: 0.3, maxTokens: 200 }
        );
        summary = result.content.replace(/^["']|["']$/g, '').trim();
      } catch {
        summary = '摘要生成失败（LLM 未配置）';
      }

      chapters.push({ index: i, title: chTitle, summary });
    }

    return chapters;
  }

  private async analyzeCharacters(text: string): Promise<Character[]> {
    const sampleText = text.slice(0, 10000);

    try {
      const result = await LLMFactory.complete(
        `分析以下小说片段，列出所有角色（姓名、角色定位）:\n\n${sampleText}\n\n请以 JSON 数组格式返回，格式: [{"name": "角色名", "role": "主角/配角/龙套", "description": "简短描述"}]`,
        { temperature: 0.3, maxTokens: 2000 }
      );

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((c: Record<string, string>, i: number) => ({
          id: `char-ai-${i + 1}`,
          name: c.name || `角色${i + 1}`,
          role: c.role,
          description: c.description,
        }));
      }
    } catch {
      // LLM 不可用则返回空
    }

    return [];
  }

  private async analyzeLocations(text: string): Promise<Location[]> {
    const sampleText = text.slice(0, 8000);

    try {
      const result = await LLMFactory.complete(
        `分析以下小说片段，列出所有出现的地点/场景:\n\n${sampleText}\n\n请以 JSON 数组格式返回，格式: [{"name": "地点名", "description": "简短描述"}]`,
        { temperature: 0.3, maxTokens: 1000 }
      );

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((l: Record<string, string>, i: number) => ({
          id: `loc-ai-${i + 1}`,
          name: l.name || `地点${i + 1}`,
          description: l.description,
        }));
      }
    } catch {
      // LLM 不可用则返回空
    }

    return [];
  }

  private async analyzeScenes(text: string, chapters: Chapter[]): Promise<Scene[]> {
    return chapters.map((ch) => ({
      chapter_index: ch.index,
      heading: ch.title,
      raw_text: text.slice(0, 1000),
      characters: [],
      locations: [],
    }));
  }

  private async generatePlotSummary(
    text: string,
    metadata: NormalizedNovel['metadata'],
    chapters: Chapter[],
    characters: Character[]
  ): Promise<string> {
    try {
      const result = await LLMFactory.complete(
        `请用 2-3 句话概括以下小说的情节:\n标题: ${metadata.title}\n作者: ${metadata.author}\n章节: ${chapters.map(c => c.title).join('、')}\n角色: ${characters.slice(0, 10).map(c => c.name).join('、')}\n\n开头片段:\n${text.slice(0, 2000)}`,
        { temperature: 0.5, maxTokens: 500 }
      );
      return result.content.trim();
    } catch {
      return `《${metadata.title}》，作者 ${metadata.author}。自动生成的情节摘要。请配置 LLM 以获取 AI 分析结果。`;
    }
  }
}
