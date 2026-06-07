import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character, NovelChapter } from '@/lib/types';

/**
 * 正则分析策略
 *
 * 在章节切分的基础上，使用正则表达式提取每章的角色和地点。
 * 章节正文保持完整，不做子场景切分。
 */
export class RegexNovelStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'regex';
  readonly description = '正则策略 — 按章节切分，正则匹配每章角色和地点';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;
    const text = rawText || '';

    onProgress?.('start', '正则分析开始...');

    // 1. 元数据
    const metadata = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: text.replace(/\s/g, '').length,
      analysis_date: Date.now(),
    };

    // 2. 章节切分 + 每章分析
    onProgress?.('chapters', '切分并分析章节...');
    const chapters = this.splitAndAnalyzeChapters(text, novel.title);

    // 3. 全书角色汇总
    onProgress?.('characters', '汇总角色...');
    const characters = this.collectCharacters(chapters);

    // 4. 情节摘要
    onProgress?.('summary', '生成摘要...');
    const plot_summary = this.buildSummary(metadata, chapters, characters);

    onProgress?.('done', '正则分析完成');

    return { metadata, characters, plot_summary, chapters };
  }

  // ── 章节切分 ──

  private splitAndAnalyzeChapters(text: string, fallbackTitle: string): NovelChapter[] {
    if (!text) {
      return [{ index: 0, title: fallbackTitle, summary: '', content: '', characters: [], locations: [] }];
    }

    const chapterPattern = /(?:^|\n)\s*(第[一二三四五六七八九十百千\d]+[章节回])\s*[^\n]*/g;
    const matches = [...text.matchAll(chapterPattern)];

    if (matches.length <= 1) {
      return [{
        index: 0,
        title: fallbackTitle,
        summary: '全文（未检测到分章标记）',
        content: text,
        characters: this.extractNames(text),
        locations: this.extractLocations(text),
      }];
    }

    const chapters: NovelChapter[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const chText = text.slice(start, end).trim();

      chapters.push({
        index: i,
        title: matches[i][1] || `第 ${i + 1} 章`,
        summary: `约 ${chText.length.toLocaleString()} 字`,
        content: chText,
        characters: this.extractNames(chText),
        locations: this.extractLocations(chText),
      });
    }

    return chapters;
  }

  // ── 角色提取 ──

  private extractNames(text: string): string[] {
    const names = new Set<string>();
    const pattern = /([^\s，。！？、：""''「」『』“”\n]{1,4})(?:说|道|问|答|喊|叫|嚷|骂|吼)/g;
    for (const m of text.matchAll(pattern)) {
      const name = m[1].trim();
      if (name.length >= 1 && name.length <= 4) names.add(name);
    }
    return [...names].slice(0, 50);
  }

  private collectCharacters(chapters: NovelChapter[]): Character[] {
    const freq = new Map<string, number>();
    for (const ch of chapters) {
      for (const name of ch.characters) freq.set(name, (freq.get(name) || 0) + 1);
    }
    let id = 0;
    return [...freq.entries()].map(([name, count]) => ({
      id: `char-${++id}`,
      name,
      role: count > 10 ? '主要角色' : count > 3 ? '次要角色' : '龙套',
    }));
  }

  // ── 地点提取 ──

  private extractLocations(text: string): string[] {
    const locs = new Set<string>();
    const pattern = /([^\s，。！？\n]{1,6}(?:府|宅|院|楼|阁|殿|宫|堂|室|厅|店|铺|街|巷|村|镇|城|市|山|林|河|湖|海|岛|谷|洞|寺|庙|园|苑|亭|台|桥|路|道|场|馆|局|所|校|医院|公司|学校|酒店|饭店|公园|花园|广场|市场))/g;
    for (const m of text.matchAll(pattern)) locs.add(m[1]);
    return [...locs].slice(0, 30);
  }

  // ── 摘要 ──

  private buildSummary(meta: NormalizedNovel['metadata'], chapters: NovelChapter[], characters: Character[]): string {
    const parts = [`《${meta.title}》，作者 ${meta.author}。`, `全书约 ${meta.word_count.toLocaleString()} 字，共 ${chapters.length} 章。`];
    const mains = characters.filter((c) => c.role === '主要角色').map((c) => c.name);
    if (mains.length > 0) parts.push(`主要角色: ${mains.join('、')}。`);
    parts.push('（由正则分析自动生成）');
    return parts.join('');
  }
}
