/**
 * 基于正则表达式的小说结构化策略
 *
 * 使用正则模式匹配:
 *   - 章节标题 (第X章, Chapter X, 数字标题)
 *   - 人物对话 (引号包裹, "某某说")
 *   - 地点场景 (环境描写模式)
 *   - 人物名称出现频率
 *
 * 相比 default 策略，regex 会做更细致的文本分析。
 * 后续可以用 AI 策略替代此策略的复杂匹配逻辑。
 */

import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character, Location, Chapter, Scene } from '@/lib/types';

export class RegexNovelStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'regex';
  readonly description = '正则分析策略 — 使用正则模式识别章节、角色、对话、地点等结构元素';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;
    const text = rawText || '';

    onProgress?.('start', '正则分析开始...');

    // 1. 元数据
    onProgress?.('metadata', '构建元数据...');
    const metadata: NormalizedNovel['metadata'] = {
      title: novel.title,
      author: novel.author || '未知',
      word_count: text.replace(/\s/g, '').length,
      analysis_date: Date.now(),
    };

    // 2. 章节检测
    onProgress?.('chapters', '正则匹配章节...');
    const chapters = this.detectChapters(text);

    // 3. 角色提取
    onProgress?.('characters', '正则匹配角色...');
    const characters = this.detectCharacters(text);

    // 4. 地点提取
    onProgress?.('locations', '正则匹配地点...');
    const locations = this.detectLocations(text);

    // 5. 场景切分
    onProgress?.('scenes', '切分场景...');
    const scenes = this.segmentScenes(text, chapters);

    // 6. 情节摘要
    onProgress?.('summary', '生成摘要...');
    const plot_summary = this.generateSummary(metadata, chapters, characters, locations);

    onProgress?.('done', '正则分析完成');

    return {
      metadata,
      characters,
      locations,
      plot_summary,
      chapters,
      scenes,
    };
  }

  // ── 章节检测 ──

  private detectChapters(text: string): Chapter[] {
    const chapters: Chapter[] = [];
    const chapterPattern = /(?:第[一二三四五六七八九十百千\d]+[章节回]|Chapter\s+\d+|^\d+[\.、\s])/gm;
    const matches = [...text.matchAll(chapterPattern)];

    if (matches.length <= 1) {
      // 尝试按空行分段作为章节
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 100);
      return paragraphs.map((_, i) => ({
        index: i,
        title: `段落 ${i + 1}`,
        summary: '',
      }));
    }

    matches.forEach((match, i) => {
      chapters.push({
        index: i,
        title: match[0],
        summary: '',
      });
    });

    return chapters;
  }

  // ── 角色检测 ──

  private detectCharacters(text: string): Character[] {
    const characterMap = new Map<string, number>();

    // 模式1: "某某说/道/问" — 对话引导
    const dialoguePattern = /([^\s，。！？、：""''「」『』“”]{1,4})(?:说|道|问|答|喊|叫|嚷|骂|吼|低声道|大声说|小声说)/g;
    for (const match of text.matchAll(dialoguePattern)) {
      const name = match[1].trim();
      if (name && name.length >= 1) {
        characterMap.set(name, (characterMap.get(name) || 0) + 1);
      }
    }

    // 模式2: 中文名 (姓+名 2-4字，高频出现)
    const chineseNamePattern = /([A-Z一-鿿]{2,4})(?=[，。！？、：\s])/g;
    for (const match of text.matchAll(chineseNamePattern)) {
      const name = match[1];
      if (name.length >= 2 && name.length <= 4) {
        characterMap.set(name, (characterMap.get(name) || 0) + 1);
      }
    }

    // 过滤: 需要出现至少 3 次
    const characters: Character[] = [];
    let idCounter = 0;
    for (const [name, count] of characterMap.entries()) {
      if (count >= 3) {
        characters.push({
          id: `char-${++idCounter}`,
          name,
          role: count > 20 ? '主角' : count > 10 ? '配角' : '龙套',
        });
      }
    }

    return characters.slice(0, 50); // 限制数量
  }

  // ── 地点检测 ──

  private detectLocations(text: string): Location[] {
    const locationMap = new Map<string, number>();

    // 常见地点后缀
    const locationPatterns = [
      /([^\s，。！？]{1,6}(?:府|宅|院|楼|阁|殿|宫|堂|室|厅|店|铺|街|巷|村|镇|城|市|山|林|河|湖|海|岛|谷|洞|寺|庙|观|庵|园|苑|亭|台|桥|路|道|场|馆|局|所|校|院|医院|公司|学校|酒店|饭店|公园|花园|广场|市场))/g,
    ];

    for (const pattern of locationPatterns) {
      for (const match of text.matchAll(pattern)) {
        const loc = match[1];
        locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
      }
    }

    const locations: Location[] = [];
    let idCounter = 0;
    for (const [name, count] of locationMap.entries()) {
      if (count >= 2) {
        locations.push({ id: `loc-${++idCounter}`, name });
      }
    }

    return locations.slice(0, 30);
  }

  // ── 场景切分 ──

  private segmentScenes(text: string, chapters: Chapter[]): Scene[] {
    const scenes: Scene[] = [];

    if (chapters.length <= 1) {
      // 无章节结构，按空行切分
      const parts = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      return parts.map((part, i) => ({
        chapter_index: 0,
        heading: `场景 ${i + 1}`,
        raw_text: part.slice(0, 500),
        characters: [],
        locations: [],
      }));
    }

    // 按章节标题切分文本
    for (let i = 0; i < chapters.length; i++) {
      const currentTitle = chapters[i].title;
      const nextTitle = i + 1 < chapters.length ? chapters[i + 1].title : null;

      const startIdx = text.indexOf(currentTitle);
      if (startIdx === -1) continue;

      const endIdx = nextTitle ? text.indexOf(nextTitle, startIdx + 1) : text.length;
      const chapterText = text.slice(startIdx, endIdx > startIdx ? endIdx : text.length);

      // 每章取前 500 字作为场景原始文本
      scenes.push({
        chapter_index: i,
        heading: currentTitle,
        raw_text: chapterText.slice(0, 500),
        characters: [],
        locations: [],
      });
    }

    return scenes;
  }

  // ── 摘要生成 ──

  private generateSummary(
    metadata: NormalizedNovel['metadata'],
    chapters: Chapter[],
    characters: Character[],
    locations: Location[]
  ): string {
    const parts: string[] = [];
    parts.push(`《${metadata.title}》，作者 ${metadata.author}。`);
    parts.push(`全文约 ${metadata.word_count.toLocaleString()} 字。`);

    if (characters.length > 0) {
      const mainChars = characters.filter(c => c.role === '主角').map(c => c.name);
      if (mainChars.length > 0) {
        parts.push(`主要角色: ${mainChars.join('、')}。`);
      }
    }

    if (locations.length > 0) {
      const topLocs = locations.slice(0, 5).map(l => l.name);
      parts.push(`涉及地点: ${topLocs.join('、')}。`);
    }

    parts.push(`共 ${chapters.length} 个章节，${chapters.length} 个场景。`);
    parts.push('（此摘要由正则分析自动生成，完整分析请使用 AI 策略）');

    return parts.join('');
  }
}
