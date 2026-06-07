/**
 * LangGraph 工作流结构化策略
 *
 * 参考 LangGraph 的 StateGraph 设计模式，手工实现多步骤分析管线:
 *   extract → analyze_characters → analyze_locations → summarize → build
 *
 * 每个节点是独立的纯函数，状态在节点间传递。
 * 提示词全部嵌入代码中，无需外部配置文件。
 */

import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, Character } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';

// ══════════════════════════════════════════════════════
// LangGraph 风格的状态定义
// ══════════════════════════════════════════════════════

interface WorkflowState {
  rawText: string;
  novelTitle: string;
  novelAuthor: string;
  chapters: Array<{ index: number; title: string; content: string; characters: string[]; locations: string[] }>;
  characters: Character[];
  plotSummary: string;
  error: string | null;
}

/** 工作流节点类型: 接收状态，返回部分更新的状态 */
type WorkflowNode = (state: WorkflowState, emit: (msg: string) => void) => Promise<Partial<WorkflowState>>;

// ══════════════════════════════════════════════════════
// 提示词模板（嵌入代码）
// ══════════════════════════════════════════════════════

const PROMPTS = {
  /** 系统提示词 — JSON 输出引擎 */
  system: '你是一个精确的 JSON 输出引擎。只返回 JSON，不包含任何解释、注释或 Markdown 格式。',

  /** 章节切分 */
  chapters: (text: string) => `你是一位专业的小说编辑。请将以下小说文本按章节拆分。

规则:
1. 识别章节标题（如"第X章"、"Chapter X"、数字标题等）
2. 为每个章节提取: 标题、正文全文
3. 以 JSON 数组返回

输入文本:
${text.slice(0, 8000)}

请严格按以下 JSON 格式返回（不要包含其他内容）:
[{"index": 0, "title": "第一章 标题", "content": "章节正文..."}]`,

  /** 角色提取 */
  characters: (text: string) => `你是一位文学分析专家。从以下章节文本中提取角色信息。

规则:
1. 识别所有有名字的角色（对话者和被提及者）
2. 判断角色定位: 主角(出现最频繁)、配角、龙套
3. 提取角色描述（外貌、性格等，如有）

章节内容:
${text.slice(0, 3000)}

请严格按以下 JSON 格式返回（不要包含其他内容）:
[{"name": "角色名", "role": "主角|配角|龙套", "description": "简短描述"}]`,

  /** 地点提取 */
  locations: (text: string) => `从以下章节文本中提取所有地点/场景名称。

规则:
1. 识别具体地点（城市、建筑、房间、自然景观）
2. 返回去重后的字符串数组

章节内容:
${text.slice(0, 3000)}

请严格按以下 JSON 格式返回（不要包含其他内容）:
["地点1", "地点2"]`,

  /** 摘要生成 */
  summary: (title: string, author: string, chapterCount: number, characters: string) =>
    `你是一位文学评论家。请用 2-3 句话概括以下小说的情节。

书名: ${title}
作者: ${author}
章节数: ${chapterCount}
主要角色: ${characters || '暂无'}

请直接返回摘要文本，不要包含任何格式标记。`,
};

// ══════════════════════════════════════════════════════
// 工作流节点实现
// ══════════════════════════════════════════════════════

/** 节点 1: 章节切分 */
const extractChaptersNode: WorkflowNode = async (state, emit) => {
  if (!state.rawText?.trim()) {
    return { chapters: [] };
  }

  emit('LLM 切分章节...');
  const prompt = PROMPTS.chapters(state.rawText);

  try {
    const result = await LLMFactory.chat(
      [
        { role: 'system', content: PROMPTS.system },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, maxTokens: 8000 }
    );

    const parsed = safeJsonParse<Array<{ index?: number; title?: string; content?: string }>>(result.content, []);
    const chapters = parsed.map((ch, i) => ({
      index: ch.index ?? i,
      title: ch.title || `第 ${i + 1} 章`,
      content: ch.content || '',
      characters: [] as string[],
      locations: [] as string[],
    }));

    emit(`识别到 ${chapters.length} 个章节`);
    return { chapters };
  } catch (err) {
    return { error: `章节切分失败: ${(err as Error).message}` };
  }
};

/** 节点 2: 角色提取 */
const analyzeCharactersNode: WorkflowNode = async (state, emit) => {
  if (state.chapters.length === 0) return {};

  emit('LLM 提取角色...');
  const allChars: Character[] = [];
  const seen = new Set<string>();

  for (const ch of state.chapters.slice(0, 10)) {
    try {
      const prompt = PROMPTS.characters(ch.content);
      const result = await LLMFactory.chat(
        [
          { role: 'system', content: PROMPTS.system },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3, maxTokens: 2000 }
      );

      const parsed = safeJsonParse<Array<{ name: string; role?: string; description?: string }>>(result.content, []);
      for (const c of parsed) {
        if (!seen.has(c.name)) {
          seen.add(c.name);
          allChars.push({
            id: `char-${allChars.length + 1}`,
            name: c.name,
            role: c.role || '配角',
            description: c.description || '',
          });
        }
        if (!ch.characters.includes(c.name)) ch.characters.push(c.name);
      }
    } catch { /* 单章失败不阻塞 */ }
  }

  emit(`识别到 ${allChars.length} 个角色`);
  return { characters: allChars, chapters: state.chapters };
};

/** 节点 3: 地点提取 */
const analyzeLocationsNode: WorkflowNode = async (state, emit) => {
  if (state.chapters.length === 0) return {};

  emit('LLM 提取地点...');
  const allLocs = new Set<string>();

  for (const ch of state.chapters.slice(0, 8)) {
    try {
      const prompt = PROMPTS.locations(ch.content);
      const result = await LLMFactory.chat(
        [
          { role: 'system', content: PROMPTS.system },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 1000 }
      );

      const parsed = safeJsonParse<string[]>(result.content, []);
      for (const loc of parsed) {
        const name = typeof loc === 'string' ? loc : String(loc);
        allLocs.add(name);
        if (!ch.locations.includes(name)) ch.locations.push(name);
      }
    } catch { /* skip */ }
  }

  emit(`识别到 ${allLocs.size} 个地点`);
  return { chapters: state.chapters };
};

/** 节点 4: 摘要生成 */
const summarizeNode: WorkflowNode = async (state, emit) => {
  emit('LLM 生成摘要...');

  const chars = state.characters.slice(0, 10).map((c) => c.name).join('、');
  const prompt = PROMPTS.summary(state.novelTitle, state.novelAuthor, state.chapters.length, chars);

  try {
    const result = await LLMFactory.complete(prompt, { temperature: 0.5, maxTokens: 500 });
    return { plotSummary: result.content.trim() };
  } catch {
    return { plotSummary: `${state.novelTitle}，作者 ${state.novelAuthor}。共 ${state.chapters.length} 章。` };
  }
};

/** 节点 5: 构建输出（纯本地操作，无需 LLM） */
const buildNode: WorkflowNode = async (state, emit) => {
  emit('构建输出...');
  return {};
};

// ══════════════════════════════════════════════════════
// 工作流执行引擎（参考 LangGraph 的编译与调用模式）
// ══════════════════════════════════════════════════════

/** 按拓扑顺序执行节点 */
async function runWorkflow(
  initialState: WorkflowState,
  nodes: Array<{ name: string; fn: WorkflowNode }>,
  emit: (msg: string) => void
): Promise<WorkflowState> {
  let state = { ...initialState };

  for (const node of nodes) {
    if (state.error) break; // 出错即停止
    const update = await node.fn(state, (msg) => emit(`[${node.name}] ${msg}`));
    state = { ...state, ...update };
  }

  return state;
}

// ══════════════════════════════════════════════════════
// JSON 解析辅助
// ══════════════════════════════════════════════════════

function safeJsonParse<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
    return fallback;
  }
}

// ══════════════════════════════════════════════════════
// 策略类
// ══════════════════════════════════════════════════════

/**
 * LangGraph 风格工作流策略
 *
 * 实现 StateGraph 的核心概念:
 * - 状态在节点间传递，每个节点返回部分更新
 * - 节点按拓扑顺序线性执行
 * - 错误时提前终止
 *
 * 配置 LLM Provider 后即可产出真实分析结果。
 */
export class LangGraphStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'langgraph';
  readonly description = 'LangGraph 策略 — 参考 LangGraph 设计模式，编排多步骤 LLM 分析管线';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel, rawText } = input;
    const text = rawText || '';

    onProgress?.('init', '初始化工作流...');

    // 定义节点图
    const nodes: Array<{ name: string; fn: WorkflowNode }> = [
      { name: 'extract', fn: extractChaptersNode },
      { name: 'characters', fn: analyzeCharactersNode },
      { name: 'locations', fn: analyzeLocationsNode },
      { name: 'summary', fn: summarizeNode },
      { name: 'build', fn: buildNode },
    ];

    // 执行工作流
    onProgress?.('execute', `执行 ${nodes.length} 个节点...`);
    const finalState = await runWorkflow(
      {
        rawText: text,
        novelTitle: novel.title,
        novelAuthor: novel.author || '未知',
        chapters: [],
        characters: [],
        plotSummary: '',
        error: null,
      },
      nodes,
      (msg) => onProgress?.('step', msg)
    );

    if (finalState.error) {
      throw new Error(finalState.error);
    }

    // 转换为 NormalizedNovel
    const totalChars = finalState.chapters.reduce((sum, ch) => sum + ch.content.length, 0);

    onProgress?.('done', `工作流完成: ${finalState.chapters.length} 章, ${finalState.characters.length} 角色`);

    return {
      metadata: {
        title: finalState.novelTitle,
        author: finalState.novelAuthor,
        word_count: totalChars,
        analysis_date: Date.now(),
      },
      characters: finalState.characters,
      plot_summary: finalState.plotSummary,
      chapters: finalState.chapters.map((ch) => ({
        index: ch.index,
        title: ch.title,
        summary: '',
        content: ch.content,
        characters: ch.characters,
        locations: ch.locations,
      })),
    };
  }
}
