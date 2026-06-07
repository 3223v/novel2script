/**
 * AI 增强管线 — 对已有结构化小说逐章补充缺失信息
 *
 * 流程:
 *   1. 逐章生成: 摘要 + 角色列表 + 地点列表
 *   2. 全书角色汇总: 合并去重
 *   3. 全书情节摘要
 *   4. 保存
 */

import path from 'path';
import type { NormalizedNovel, Character } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';
import NovelStructuringPipeline from './novel-structuring';
import NovelService from '@/lib/novel-service';

const SYS = '你是一个精确的 JSON 输出引擎。只返回 JSON，不包含任何解释、Markdown 或额外文本。';

// ── 提示词 ──

const chapterEnrichPrompt = (title: string, content: string) =>
  `分析以下小说章节，提取三项信息:

章节标题: ${title}
章节内容:
${content.slice(0, 5000)}

请返回一个 JSON 对象，格式如下（不要包含其他内容）:
{
  "summary": "一句话概括本章内容",
  "characters": ["角色名1", "角色名2"],
  "locations": ["地点1", "地点2"]
}`;

const fullBookPrompt = (title: string, author: string, chapInfo: string) =>
  `请根据以下章节信息生成全书的综合分析:

书名: ${title}
作者: ${author}
章节概要:
${chapInfo}

请返回一个 JSON 对象（不要包含其他内容）:
{
  "plot_summary": "2-3句话概括全书情节",
  "characters": [
    {"name": "角色名", "role": "主角|配角|龙套", "description": "简短外貌/背景描述", "personality": "性格特征"}
  ]
}`;

export interface EnhancementProgress {
  stage: string;
  detail: string;
  current?: number;
  total?: number;
}

export class NovelEnhancementPipeline {
  static async execute(
    novelId: string,
    onProgress?: (p: EnhancementProgress) => void
  ): Promise<{ success: boolean; data?: NormalizedNovel; error?: string }> {
    const novel = NovelService.getById(novelId);
    if (!novel) return { success: false, error: '小说不存在' };

    let data = NovelStructuringPipeline.loadNormalizedData(novelId);
    if (!data) return { success: false, error: '结构化数据不存在，请先执行结构化分析' };

    // 自动加载最新配置
    LLMFactory.reload();

    try {
      const chapters = data.chapters;
      let changed = false;

      // ── 步骤 1: 逐章增强 ──
      if (chapters.length > 0) {
        onProgress?.({ stage: 'chapters', detail: '逐章 AI 分析中...', total: chapters.length });

        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const needsSummary = !ch.summary || ch.summary.includes('待分析');
          const needsChars = !ch.characters || ch.characters.length === 0;
          const needsLocs = !ch.locations || ch.locations.length === 0;

          if (needsSummary || needsChars || needsLocs) {
            onProgress?.({ stage: 'chapters', detail: `分析第 ${i + 1}/${chapters.length} 章: ${ch.title}`, current: i + 1, total: chapters.length });

            try {
              const prompt = chapterEnrichPrompt(ch.title, ch.content);
              const result = await LLMFactory.chat(
                [{ role: 'system', content: SYS }, { role: 'user', content: prompt }],
                { temperature: 0.3, maxTokens: 1500 }
              );
              const parsed = safeJson<{ summary?: string; characters?: string[]; locations?: string[] }>(result.content);
              if (parsed) {
                chapters[i] = {
                  ...ch,
                  summary: parsed.summary || ch.summary,
                  characters: parsed.characters?.length ? parsed.characters : ch.characters,
                  locations: parsed.locations?.length ? parsed.locations : ch.locations,
                };
                changed = true;
              }
            } catch { /* 单章失败继续 */ }
          }
        }
        data = { ...data, chapters };
      }

      // ── 步骤 2: 全书分析 ──
      const chapInfo = chapters
        .slice(0, 20)
        .map((c) => `${c.title}: ${c.summary || '(无)'}`)
        .join('\n');

      const needsPlotSummary = !data.plot_summary || data.plot_summary.includes('待分析');
      const needsCharacters = !data.characters || data.characters.length === 0;

      if (needsPlotSummary || needsCharacters) {
        onProgress?.({ stage: 'full', detail: '全书 AI 分析...' });

        try {
          const prompt = fullBookPrompt(data.metadata.title, data.metadata.author, chapInfo);
          const result = await LLMFactory.chat(
            [{ role: 'system', content: SYS }, { role: 'user', content: prompt }],
            { temperature: 0.5, maxTokens: 3000 }
          );
          const parsed = safeJson<{
            plot_summary?: string;
            characters?: Array<{ name: string; role?: string; description?: string; personality?: string }>;
          }>(result.content);

          if (parsed) {
            if (parsed.plot_summary) {
              data = { ...data, plot_summary: parsed.plot_summary };
              changed = true;
            }
            if (parsed.characters?.length) {
              const merged = mergeCharacters(data.characters, parsed.characters);
              data = { ...data, characters: merged };
              changed = true;
            }
          }
        } catch { /* skip */ }
      }

      // ── 步骤 3: 保存 ──
      if (changed) {
        onProgress?.({ stage: 'save', detail: '保存增强数据...' });
        await NovelStructuringPipeline.saveNormalizedData(novelId, data);
        NovelService.setNormalizedPath(novelId, path.join(novelId, 'normalized.json'));
      }

      onProgress?.({ stage: 'done', detail: changed ? 'AI 增强完成' : '无需增强，数据已完整' });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

/** 合并角色列表（新角色追加，已有角色补充信息） */
function mergeCharacters(
  existing: Character[],
  aiChars: Array<{ name: string; role?: string; description?: string; personality?: string }>
): Character[] {
  const map = new Map<string, Character>();
  for (const c of existing) map.set(c.name, c);
  for (const ac of aiChars) {
    if (map.has(ac.name)) {
      const old = map.get(ac.name)!;
      map.set(ac.name, {
        ...old,
        role: old.role || ac.role,
        description: old.description || ac.description,
        personality: old.personality || ac.personality,
      });
    } else {
      map.set(ac.name, {
        id: `char-ai-${map.size + 1}`,
        name: ac.name,
        role: ac.role || '配角',
        description: ac.description,
        personality: ac.personality,
      });
    }
  }
  return [...map.values()];
}

function safeJson<T>(content: string): T | null {
  try { return JSON.parse(content); } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}
