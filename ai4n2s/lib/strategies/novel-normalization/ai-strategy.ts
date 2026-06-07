import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character, NovelChapter } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';
import { RAGFactory } from '@/lib/modules/rag';

/**
 * AI 工作流策略
 *
 * 分步调用 LLM:
 *   1. 章节切分（先正则粗切，LLM 补充摘要）
 *   2. 每章的角色 / 地点提取
 *   3. 全书角色汇总
 *   4. 情节摘要生成
 *
 * 当前为骨架实现 — 配置真实 LLM Provider 后产出实际结果。
 */
export class AIStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'ai-workflow';
  readonly description = 'AI 策略 — 使用 LLM 逐步分析，生成章节摘要和角色/地点信息';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;
    const text = rawText || '';

    onProgress?.('start', 'AI 分析开始...');

    // 长文本建立 RAG 索引
    if (text.length > 5000) {
      onProgress?.('indexing', '文本较长，建立 RAG 索引...');
      await RAGFactory.indexDocument(novel.id, text, { chunkSize: 3000, overlap: 300 });
    }

    // 1. 元数据
    const metadata = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: text.replace(/\s/g, '').length,
      analysis_date: Date.now(),
    };

    // 2. 章节切分（先用正则粗切）
    onProgress?.('chapters', '切分章节...');
    const chapters = await this.buildChapters(text, novel.title);

    // 3. 每章 AI 分析（角色 + 地点 + 摘要）
    onProgress?.('analyze', 'AI 分析每章内容...');
    for (let i = 0; i < chapters.length; i++) {
      onProgress?.('chapter', `分析第 ${i + 1}/${chapters.length} 章...`);
      await this.enrichChapter(chapters[i]);
    }

    // 4. 全书角色汇总
    onProgress?.('characters', '汇总角色...');
    const characters = this.collectCharacters(chapters);

    // 5. 情节摘要
    onProgress?.('summary', '生成情节摘要...');
    const plot_summary = await this.generatePlotSummary(metadata, chapters, characters);

    onProgress?.('done', 'AI 分析完成');

    return { metadata, characters, plot_summary, chapters };
  }

  // ── 章节切分 ──

  private async buildChapters(text: string, fallbackTitle: string): Promise<NovelChapter[]> {
    if (!text) {
      return [{ index: 0, title: fallbackTitle, summary: '', content: '', characters: [], locations: [] }];
    }

    const chapterPattern = /(?:^|\n)\s*(第[一二三四五六七八九十百千\d]+[章节回])\s*[^\n]*/g;
    const matches = [...text.matchAll(chapterPattern)];

    if (matches.length <= 1) {
      return [{
        index: 0,
        title: fallbackTitle,
        summary: '全文（未检测到分章）',
        content: text,
        characters: [],
        locations: [],
      }];
    }

    const chapters: NovelChapter[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const chText = text.slice(start, end).trim();

      // AI 生成章节摘要
      let summary = '';
      try {
        const result = await LLMFactory.complete(
          `请用一句话概括以下章节的内容:\n\n${chText.slice(0, 1500)}`,
          { temperature: 0.3, maxTokens: 200 }
        );
        summary = result.content.replace(/^["']|["']$/g, '').trim();
      } catch {
        summary = `第 ${i + 1} 章（AI 未配置）`;
      }

      chapters.push({
        index: i,
        title: matches[i][1] || `第 ${i + 1} 章`,
        summary,
        content: chText,
        characters: [],
        locations: [],
      });
    }

    return chapters;
  }

  // ── 单章丰富 ──

  private async enrichChapter(ch: NovelChapter): Promise<void> {
    const sample = ch.content.slice(0, 3000);
    if (!sample) return;

    try {
      const result = await LLMFactory.complete(
        `分析以下小说章节，提取:\n1. 角色列表（姓名，逗号分隔）\n2. 地点列表（名称，逗号分隔）\n\n章节内容:\n${sample}\n\n请严格按以下格式输出:\n角色: 名1, 名2\n地点: 地1, 地2`,
        { temperature: 0.3, maxTokens: 500 }
      );

      const charMatch = result.content.match(/角色[:：]\s*(.+)/);
      const locMatch = result.content.match(/地点[:：]\s*(.+)/);

      if (charMatch) ch.characters = charMatch[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
      if (locMatch) ch.locations = locMatch[1].split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    } catch {
      // LLM 不可用时保持空列表
    }
  }

  // ── 角色汇总 ──

  private collectCharacters(chapters: NovelChapter[]): Character[] {
    const map = new Map<string, number>();
    for (const ch of chapters) {
      for (const name of ch.characters) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    }
    let id = 0;
    return [...map.entries()].map(([name, count]) => ({
      id: `char-${++id}`,
      name,
      role: count > chapters.length * 0.5 ? '主角' : count > 2 ? '配角' : '龙套',
    }));
  }

  // ── 全局摘要 ──

  private async generatePlotSummary(
    meta: NormalizedNovel['metadata'],
    chapters: NovelChapter[],
    characters: Character[]
  ): Promise<string> {
    const charNames = characters.slice(0, 10).map((c) => c.name).join('、');
    const chTitles = chapters.slice(0, 10).map((c) => c.title).join('、');

    try {
      const result = await LLMFactory.complete(
        `请用 2-3 句话概括以下小说的情节:\n标题: ${meta.title}\n作者: ${meta.author}\n主要角色: ${charNames}\n章节: ${chTitles}`,
        { temperature: 0.5, maxTokens: 500 }
      );
      return result.content.trim();
    } catch {
      return `《${meta.title}》，作者 ${meta.author}。共 ${chapters.length} 章，${characters.length} 个角色。请配置 LLM 以获取 AI 摘要。`;
    }
  }
}
