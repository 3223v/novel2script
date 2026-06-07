import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, NovelChapter } from '@/lib/types';

/**
 * 默认结构化策略
 *
 * 将原始文本按章节检测结果切分为章节数组。
 * 每个章节保留其完整正文、摘要占位、以及该章涉及的角色/地点（空列表）。
 */
export class DefaultNovelStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'default';
  readonly description = '默认策略 — 按章节分割文本，保留完整正文，元数据来自小说基本信息';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;

    onProgress?.('start', '开始构建章节结构...');

    // 1. 元数据
    onProgress?.('metadata', '填充元数据...');
    const metadata = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: rawText ? rawText.replace(/\s/g, '').length : 0,
      analysis_date: Date.now(),
    };

    // 2. 章节切分 — 核心步骤
    onProgress?.('chapters', '检测并切分章节...');
    const chapters = this.splitChapters(rawText || '', novel.title);

    // 3. 情节摘要
    onProgress?.('summary', '生成全书摘要...');
    const plot_summary = `《${novel.title}》，作者 ${novel.author || '未知'}。共 ${chapters.length} 章，总计约 ${metadata.word_count.toLocaleString()} 字。`;

    onProgress?.('done', '章节结构构建完成');

    return {
      metadata,
      characters: [],
      plot_summary,
      chapters,
    };
  }

  /**
   * 从原始文本中检测章节边界并切分。
   *
   * 支持的章节标题模式:
   *   - "第X章" / "第X节" / "第X回"
   *   - "Chapter X"
   *   - 纯数字标题行（如 "1." "1、"）
   *
   * 如果未检测到任何章节标记，整段文本视为一个章节。
   */
  private splitChapters(text: string, fallbackTitle: string): NovelChapter[] {
    if (!text || text.trim().length === 0) {
      return [{
        index: 0,
        title: fallbackTitle,
        summary: '待分析',
        content: '',
        characters: [],
        locations: [],
      }];
    }

    // 尝试匹配中文章节标题
    const patterns = [
      /(?:^|\n)\s*(第[一二三四五六七八九十百千\d]+[章节回])\s*[^\n]*/g,
      /(?:^|\n)\s*(Chapter\s+\d+)\s*[^\n]*/gi,
      /(?:^|\n)\s*(\d+[\.\、\s]\s*[^\n]{2,})/g,
    ];

    let matches: Array<{ index: number; title: string }> = [];

    for (const pattern of patterns) {
      const found = [...text.matchAll(pattern)];
      if (found.length > 1) {
        matches = found.map((m) => ({
          index: m.index!,
          title: (m[1] || m[0]).trim(),
        }));
        break;
      }
    }

    // 未检测到章节 — 整文为一个章节
    if (matches.length === 0) {
      return [{
        index: 0,
        title: fallbackTitle,
        summary: '全文（未检测到分章标记）',
        content: text,
        characters: [],
        locations: [],
      }];
    }

    // 按章节标题位置切分
    const chapters: NovelChapter[] = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const chapterText = text.slice(start, end).trim();

      chapters.push({
        index: i,
        title: matches[i].title,
        summary: `第 ${i + 1} 章待分析`,
        content: chapterText,
        characters: [],
        locations: [],
      });
    }

    return chapters;
  }
}
