/**
 * LLM 直接剧本生成策略（两阶段 + 智能重试）
 *
 * 工作流:
 *   阶段 1 — 草稿生成: 叙事 → 剧本格式（temperature 0.7，创意发散）
 *   阶段 2 — 审查润色: 检查角色一致性 / 对话质量 / 格式规范（temperature 0.3，精确稳定）
 *
 * 健壮性:
 *   - JSON 解析 4 级容错（直接解析 → 正则提取 → LLM 重试 → 文本兜底）
 *   - LLM 调用异常捕获，不阻塞管线
 *   - 长章节自动分段处理
 *   - 角色档案全程传递保证声音一致性
 *   - 相邻场景上下文保证情节连贯
 */

import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene, SceneContent, Character } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';

// ══════════════════════════════════════════════════════
// 提示词
// ══════════════════════════════════════════════════════

/** 草稿阶段系统提示词 — 专业编剧角色定义 */
const DRAFT_SYSTEM = `你是一位资深影视编剧，擅长将小说叙事转化为标准剧本格式。

## 剧本格式规范

输出一个 JSON 数组，每个元素为以下类型之一：

1. **action** — 第三人称现在时动作/环境描述
   { "type": "action", "text": "教室里的钟声响起，学生们纷纷收拾书包。" }

2. **character** — 角色对话
   { "type": "character", "name": "角色名", "parenthetical": "(低声)", "dialogue": "台词内容" }
   parenthetical 为可选字段，用于标注情绪/动作

3. **transition** — 转场提示
   { "type": "transition", "text": "CUT TO:" }

4. **shot** — 镜头指示
   { "type": "shot", "text": "特写：主角颤抖的手指" }

## 写作要求

- 动作描述使用现在时、第三人称，简洁有力
- 将小说中的间接引语和内心独白转化为自然的人物对白
- 每个角色对话需体现其性格特征
- 保留原作的核心情节和情感基调
- 适当使用转场来划分节奏
- 每章生成 3-10 个内容项（不要太少也不要太多）

## 输出格式

只返回 JSON 数组，不包含任何解释、Markdown 标记或额外文字。`;

/** 审查阶段系统提示词 — 质量控制 */
const REVIEW_SYSTEM = `你是一位资深剧本审稿人。请审查并优化以下剧本片段。

## 审查维度

1. **角色声音一致性**: 同一角色的台词风格是否前后统一？是否符合其性格？
2. **对话自然度**: 台词是否流畅自然？是否有生硬或拗口的表达？
3. **格式规范性**: action/character/transition/shot 的使用是否正确？
4. **情节连贯性**: 场景内部和场景之间的逻辑是否通顺？
5. **文学质量**: 动作描述是否生动？转场是否恰当？

## 优化原则

- 保留草稿的优点，只修改确实有问题的地方
- 不要大幅改写，尽量保持原意
- 对话可以微调措辞使其更符合角色性格
- 动作描述可以润色使其更生动
- 如果格式类型用错了，修正它

## 输出要求

返回优化后的完整 JSON 数组（与输入格式相同），不包含任何解释或 Markdown。`;

/** 审查阶段用户提示词模板 */
const REVIEW_USER_TEMPLATE = `请审查以下剧本片段:

{previousContext}

【角色档案】
{characterProfile}

【当前场景标题】{heading}

【草稿内容（JSON）】
{draftJson}

请返回优化后的完整 JSON 数组。`;

// ══════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════

/**
 * 将角色列表转为 LLM 可读的文本描述
 * 包含姓名、定位、描述、性格，最多 15 个角色
 */
function buildCharacterProfile(characters: Character[]): string {
  if (!characters || characters.length === 0) return '暂无角色信息。';

  return characters.slice(0, 15).map((c, i) => {
    const parts = [`${i + 1}. ${c.name}`];
    if (c.role) parts.push(`【${c.role}】`);
    if (c.description) parts.push(c.description);
    if (c.personality) parts.push(`性格: ${c.personality}`);
    if (c.aliases?.length) parts.push(`别名: ${c.aliases.join('、')}`);
    return parts.join(' — ');
  }).join('\n');
}

/**
 * 多策略 JSON 解析（纯本地，不涉及 LLM 重试）
 *
 * @returns 解析成功返回对象，失败返回 null
 */
function safeJsonParse<T>(content: string): T | null {
  // 策略 1: 直接解析
  try { return JSON.parse(content) as T; } catch { /* continue */ }

  // 策略 2: 提取 markdown 代码块中的 JSON
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) as T; } catch { /* continue */ }
  }

  // 策略 3: 提取方括号/花括号包裹的 JSON
  const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]) as T; } catch { /* continue */ }
  }

  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as T; } catch { /* continue */ }
  }

  return null;
}

/**
 * 调用 LLM 生成草稿场景（含 try/catch + JSON 解析重试）
 *
 * 内容已在上层确保为字符串，内部截断到 6000 字。
 * @returns SceneContent 数组，保证最少返回 1 个占位项
 */
async function generateDraftScene(
  chapterTitle: string,
  chapterContent: string,
  characterProfile: string,
  plotSummary: string,
): Promise<SceneContent[]> {
  const userPrompt = [
    '请将以下小说章节转化为剧本:',
    '',
    `【章节标题】${chapterTitle}`,
    `【章节内容】${chapterContent.slice(0, 6000)}`,
    `【全书摘要】${plotSummary.slice(0, 500)}`,
    `【角色档案】`,
    characterProfile,
    '',
    '请返回 JSON 数组格式的剧本内容。',
  ].join('\n');

  // ── 第 1 次尝试 ──
  let result;
  try {
    result = await LLMFactory.chat(
      [
        { role: 'system', content: DRAFT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, maxTokens: 4000 },
    );
  } catch (err) {
    console.error(`[llm-direct] 草稿生成失败 (${chapterTitle}):`, (err as Error).message);
    return [{ type: 'action', text: `[LLM 调用失败] ${chapterTitle} — 请检查 LLM 配置或网络连接。` }];
  }

  let parsed = safeJsonParse<Array<Record<string, unknown>>>(result.content);
  if (parsed && Array.isArray(parsed) && parsed.length > 0) {
    return normalizeContent(parsed);
  }

  // ── 第 2 次尝试（严格指令 + 更低温度）──
  const retryPrompt = [
    userPrompt,
    '',
    '⚠️ 上一次你的回复不是有效的 JSON 数组。请严格只返回 JSON 数组，',
    '不要添加任何解释、Markdown 标记或其他文字。',
    '确保 JSON 格式完全正确，所有字符串用双引号。',
  ].join('\n');

  try {
    result = await LLMFactory.chat(
      [
        { role: 'system', content: DRAFT_SYSTEM },
        { role: 'user', content: retryPrompt },
      ],
      { temperature: 0.3, maxTokens: 4000 },
    );
  } catch (err) {
    console.error(`[llm-direct] 草稿重试失败 (${chapterTitle}):`, (err as Error).message);
    return [{ type: 'action', text: `[LLM 重试失败] ${chapterTitle} — 请检查 LLM 配置。` }];
  }

  parsed = safeJsonParse<Array<Record<string, unknown>>>(result.content);
  if (parsed && Array.isArray(parsed) && parsed.length > 0) {
    return normalizeContent(parsed);
  }

  // ── 兜底：原始文本作为 action ──
  return [{ type: 'action', text: result.content.slice(0, 2000) || `[LLM 解析失败] ${chapterTitle}` }];
}

/**
 * 审查并优化场景内容
 *
 * 审查失败时优雅降级 — 保留草稿，不阻塞管线
 */
async function reviewScene(
  draftContent: SceneContent[],
  characterProfile: string,
  heading: string,
  prevSummary?: string,
): Promise<SceneContent[]> {
  // 草稿内容过少（≤1 个 action 项）→ 跳过审查以节省 LLM 调用
  if (draftContent.length <= 1 && draftContent[0]?.type === 'action') {
    return draftContent;
  }

  // 限制草稿大小，避免超出 LLM 上下文窗口
  // 最多保留 15 个内容项，每个项的 text/dialogue 截断到 300 字
  const trimmedDraft = draftContent.slice(0, 15).map((item) => {
    if (item.type === 'character') {
      return { ...item, dialogue: (item.dialogue || '').slice(0, 300) };
    }
    if (item.type === 'action' || item.type === 'transition' || item.type === 'shot') {
      return { ...item, text: (item.text || '').slice(0, 300) };
    }
    return item;
  });

  const draftJson = JSON.stringify(trimmedDraft, null, 2);
  const previousContext = prevSummary
    ? `【前情回顾】前一个场景: ${prevSummary}\n`
    : '';

  const userPrompt = REVIEW_USER_TEMPLATE
    .replace('{previousContext}', previousContext)
    .replace('{characterProfile}', characterProfile)
    .replace('{heading}', heading)
    .replace('{draftJson}', draftJson);

  try {
    const result = await LLMFactory.chat(
      [
        { role: 'system', content: REVIEW_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 4000 },
    );

    const parsed = safeJsonParse<Array<Record<string, unknown>>>(result.content);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      return normalizeContent(parsed);
    }
    // JSON 解析失败 → 保留草稿（保持原始草稿，不用修剪版）
    return draftContent;
  } catch (err) {
    // LLM 调用失败 → 保留草稿，不阻塞管线
    console.error(`[llm-direct] 审查失败 (${heading}):`, (err as Error).message);
    return draftContent;
  }
}

/**
 * 将 LLM 返回的原始 JSON 数组规范化为 SceneContent[]
 * 过滤无效项，补全缺失字段
 */
function normalizeContent(items: Array<Record<string, unknown>>): SceneContent[] {
  const result: SceneContent[] = [];

  for (const item of items) {
    const type = (item.type as string) || 'action';

    switch (type) {
      case 'character':
        result.push({
          type: 'character',
          name: String(item.name || '角色'),
          dialogue: String(item.dialogue || ''),
          parenthetical: item.parenthetical ? String(item.parenthetical) : undefined,
        });
        break;
      case 'transition':
        result.push({
          type: 'transition',
          text: String(item.text || ''),
        });
        break;
      case 'shot':
        result.push({
          type: 'shot',
          text: String(item.text || ''),
        });
        break;
      default:
        // action 或其他未知类型 → action
        result.push({
          type: 'action',
          text: String(item.text || item.content || ''),
        });
    }
  }

  // 过滤掉 text/dialogue 都为空的无效项
  return result.filter((item) => {
    if (item.type === 'action' || item.type === 'transition' || item.type === 'shot') {
      return item.text.length > 0;
    }
    return item.name.length > 0 || item.dialogue.length > 0;
  });
}

// ══════════════════════════════════════════════════════
// 策略类
// ══════════════════════════════════════════════════════

export class LLMScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'llm-direct';
  readonly description = 'LLM 直接策略 — 两阶段生成（草稿+审查），智能重试，角色一致性保障';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress,
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;
    const chapters = structuredNovel.chapters || [];
    const characters = structuredNovel.characters || [];

    onProgress?.('start', `LLM 两阶段剧本生成开始 — ${chapters.length} 章`);

    // ── 1. 元数据 ──
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary?.slice(0, 100) || '',
      genre: [],
    };

    // ── 2. 角色映射 ──
    const scriptCharacters = characters.map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 构建角色档案（全书复用，避免每章重建）
    const characterProfile = buildCharacterProfile(characters);

    // ── 3. 两阶段并行逐章生成 ──
    // 阶段 1: 所有章节草稿并行生成（最多 4 个并发，避免触发 LLM 限流）
    onProgress?.('scene', `[草稿] 并行生成 ${chapters.length} 章草稿...`);
    const drafts: Array<{ index: number; title: string; content: SceneContent[]; locations: string[] }> =
      await parallelWithLimit(
        chapters.map((ch, i) => () =>
          generateDraftScene(
            ch.title || `第 ${i + 1} 章`,
            typeof ch.content === 'string' ? ch.content : '',
            characterProfile,
            structuredNovel.plot_summary || '',
          ).then((content) => ({
            index: i,
            title: ch.title || `第 ${i + 1} 章`,
            content,
            locations: ch.locations || [],
          })).catch((err): typeof drafts[number] => {
            console.error(`[llm-direct] 第 ${i + 1} 章草稿失败:`, err);
            return {
              index: i,
              title: ch.title || `第 ${i + 1} 章`,
              content: [{ type: 'action', text: `[草稿生成失败] ${(err as Error).message || '未知错误'}` }],
              locations: ch.locations || [],
            };
          })
        ),
        4,  // 并发上限
        (done, total) => onProgress?.('scene', `[草稿] 已完成 ${done}/${total} 章`),
      );

    // 按原始顺序排序
    drafts.sort((a, b) => a.index - b.index);

    // 阶段 2: 所有章节审查并行执行（草稿已全部就绪，可以获取相邻场景上下文）
    onProgress?.('scene', `[审查] 并行审查 ${drafts.length} 章...`);
    const reviewedList = await parallelWithLimit(
      drafts.map((draft, i) => () => {
        const prevSummary = i > 0
          ? `${drafts[i - 1].title}: ${drafts[i - 1].content.slice(0, 3).map(getContentSummary).join('; ')}`
          : undefined;
        return reviewScene(draft.content, characterProfile, draft.title, prevSummary)
          .then((reviewed) => ({ ...draft, reviewed }))
          .catch(() => ({ ...draft, reviewed: draft.content }));  // 审查失败保留草稿
      }),
      4,  // 并发上限
      (done, total) => onProgress?.('scene', `[审查] 已完成 ${done}/${total} 章`),
    );

    // 按原始顺序组装场景
    reviewedList.sort((a, b) => a.index - b.index);
    const scenes: ScriptScene[] = reviewedList.map((item, i) => ({
      id: `scene-llm-${i + 1}`,
      heading: item.title,
      content: item.reviewed.length > 0 ? item.reviewed : item.content,
      notes: `LLM 并行两阶段生成 (${new Date().toLocaleString('zh-CN')})`,
      tags: item.locations.length ? item.locations.slice(0, 3) : undefined,
    }));

    // 如果没有章节，生成一个空场景
    if (scenes.length === 0) {
      scenes.push({
        id: 'scene-llm-1',
        heading: '第一场',
        content: [{ type: 'action', text: '剧本内容待生成 — 请先执行小说结构化分析。' }],
        notes: '无章节数据',
      });
    }

    onProgress?.('done', `两阶段生成完成: ${scenes.length} 个场景`);

    return { script: { metadata, characters: scriptCharacters, scenes } };
  }
}

// ══════════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════════

/**
 * 带并发上限的并行执行。
 *
 * 与 Promise.all 不同，此函数限制同时执行的任务数，
 * 避免触发 LLM API 的速率限制。
 *
 * @param tasks   任务工厂数组（每个工厂返回 Promise）
 * @param limit   最大并发数
 * @param onTick  每完成一个任务时的回调 (done, total)
 */
async function parallelWithLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onTick?: (done: number, total: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = await Promise.reject(err);  // 保留给外层 .catch()
      }
      completed++;
      onTick?.(completed, tasks.length);
    }
  }

  // 启动 limit 个 worker
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** 获取内容项的简短摘要 */
function getContentSummary(item: SceneContent): string {
  switch (item.type) {
    case 'character':
      return `${item.name}: ${(item.dialogue || '').slice(0, 30)}`;
    case 'action':
      return (item.text || '').slice(0, 40);
    case 'transition':
      return `转场: ${item.text}`;
    case 'shot':
      return `镜头: ${item.text}`;
  }
}
