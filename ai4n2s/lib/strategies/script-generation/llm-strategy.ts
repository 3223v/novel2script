/**
 * LLM 直接剧本生成策略（无 RAG）
 *
 * 直接将结构化小说数据传给 LLM，逐章生成剧本场景。
 * 不需要 RAG 索引，适合中小规模小说。
 */

import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene, SceneContent } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';

const SYSTEM_PROMPT = `你是一位资深编剧。将小说章节转化为标准剧本格式。

输出 JSON 数组，每个元素为剧本内容项:
- action: {"type":"action","text":"第三人称动作/环境描述"}
- character: {"type":"character","name":"角色名","parenthetical":"(情绪,可选)","dialogue":"台词"}
- transition: {"type":"transition","text":"CUT TO:"}
- shot: {"type":"shot","text":"特写镜头"}

要求:
1. 将叙事描述转化为动作描述(action)
2. 将间接引语转化为角色对话(character)
3. 保持原作风格，适当改编为剧本语言
4. 每章生成 3-8 个内容项`;

const SCENE_PROMPT = `请将以下小说章节转化为剧本场景:

【章节标题】{title}
【章节内容】{content}
【本章角色】{characters}
【本章地点】{locations}
【全书摘要】{summary}

请返回 JSON 数组格式的剧本内容。`;

export class LLMScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'llm-direct';
  readonly description = 'LLM 直接策略 — 直接将结构化小说数据传给 LLM 逐章生成剧本（无需 RAG）';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;

    onProgress?.('start', 'LLM 直接剧本生成开始...');

    // 元数据
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary?.slice(0, 100) || '',
      genre: [],
    };

    // 角色
    const characters = (structuredNovel.characters || []).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 逐章生成
    const chapters = structuredNovel.chapters || [];
    onProgress?.('scenes', `开始生成 ${chapters.length} 个场景...`);
    const scenes: ScriptScene[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      onProgress?.('scene', `生成场景 ${i + 1}/${chapters.length}: ${ch.title}`);

      try {
        const prompt = SCENE_PROMPT
          .replace('{title}', ch.title)
          .replace('{content}', (ch.content || '').slice(0, 4000))
          .replace('{characters}', (ch.characters || []).join('、') || '未知')
          .replace('{locations}', (ch.locations || []).join('、') || '未知')
          .replace('{summary}', structuredNovel.plot_summary?.slice(0, 500) || '');

        const result = await LLMFactory.chat(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.7, maxTokens: 3000 }
        );

        const content = this.parseSceneContent(result.content);
        scenes.push({
          id: `scene-llm-${i + 1}`,
          heading: ch.title,
          content,
          notes: `LLM 直接生成 (${new Date().toLocaleString('zh-CN')})`,
        });
      } catch {
        scenes.push({
          id: `scene-llm-${i + 1}`,
          heading: ch.title,
          content: [{ type: 'action', text: `[待 LLM 生成] ${ch.summary || ch.title}` }],
          notes: 'LLM 未配置，此为占位内容',
        });
      }
    }

    onProgress?.('done', `剧本生成完成，共 ${scenes.length} 个场景`);

    return { script: { metadata, characters, scenes } };
  }

  private parseSceneContent(llmResponse: string): SceneContent[] {
    try {
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: Record<string, unknown>) => {
            switch (item.type) {
              case 'character':
                return { type: 'character', name: String(item.name || ''), dialogue: String(item.dialogue || ''), parenthetical: item.parenthetical as string | undefined };
              case 'transition':
                return { type: 'transition', text: String(item.text || '') };
              case 'shot':
                return { type: 'shot', text: String(item.text || '') };
              default:
                return { type: 'action', text: String(item.text || '') };
            }
          });
        }
      }
      return [{ type: 'action', text: llmResponse.slice(0, 1000) }];
    } catch {
      return [{ type: 'action', text: llmResponse.slice(0, 1000) }];
    }
  }
}
