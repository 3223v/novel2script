/**
 * 基于 AI + RAG 的剧本生成策略
 *
 * 流程:
 *   1. 将结构化小说数据建立 RAG 索引
 *   2. 分场景逐个调用 LLM 生成剧本内容
 *   3. 对每个场景:
 *      - 用 RAG 检索相关的小说原文和角色信息
 *      - 用 LLM 将小说叙事转化为剧本格式 (动作描述 + 角色对话)
 *   4. 汇总所有场景，生成完整 ScriptYAML
 *
 * 当前为骨架实现 — LLM 调用返回占位内容。
 * 配置真实 LLM 后即可产出实际剧本。
 */

import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene, SceneContent } from '@/lib/types';
import { LLMFactory, type ChatMessage } from '@/lib/modules/llm';
import { RAGFactory } from '@/lib/modules/rag';

// ── Prompt 模板 ──

const SCENE_GENERATION_SYSTEM = `你是一位专业的编剧。你的任务是将小说场景转化为标准剧本格式。

剧本格式要求:
- 动作描述 (action): 以第三人称描述场景中发生的动作、环境、氛围
- 角色对话 (character): 格式包含 name(角色名)、dialogue(台词)、可选的 parenthetical(括号说明)
- 转场 (transition): 场景切换提示
- 镜头 (shot): 镜头指示

请以 JSON 格式返回场景内容数组。`;

export class AIRAGScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'ai-rag';
  readonly description = 'AI+RAG 联合策略 — 使用检索增强生成，将小说逐场景转化为专业剧本';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;

    onProgress?.('start', 'AI+RAG 剧本生成开始...');

    // 1. 建立 RAG 索引 (结构化小说数据)
    onProgress?.('indexing', '建立 RAG 索引...');
    await this.buildRAGIndex(novel.id, structuredNovel);

    // 2. 构建元数据
    onProgress?.('metadata', '构建剧本元数据...');
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary?.slice(0, 100) || '',
      genre: [],
    };

    // 3. 映射角色
    const characters = (structuredNovel.characters || []).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 4. 逐场景生成剧本内容
    onProgress?.('scenes', `开始生成 ${structuredNovel.scenes.length} 个场景...`);
    const scenes = await this.generateScenes(structuredNovel, novel.id, onProgress);

    onProgress?.('done', `剧本生成完成，共 ${scenes.length} 个场景`);

    return {
      script: {
        metadata,
        characters,
        scenes,
      },
    };
  }

  // ── RAG 索引 ──

  private async buildRAGIndex(
    novelId: string,
    structuredNovel: import('@/lib/types').NormalizedNovel
  ): Promise<void> {
    // 索引情节摘要
    await RAGFactory.indexDocument(`${novelId}-plot`, structuredNovel.plot_summary || '', {
      chunkSize: 1000,
    });

    // 索引每个场景的原文
    for (const scene of structuredNovel.scenes) {
      if (scene.raw_text) {
        await RAGFactory.indexDocument(`${novelId}-scene-${scene.chapter_index}`, scene.raw_text, {
          chunkSize: 2000,
        });
      }
    }

    // 索引角色信息
    const characterText = structuredNovel.characters
      .map((c) => `角色: ${c.name}\n别名: ${(c.aliases || []).join(', ')}\n描述: ${c.description || ''}\n性格: ${c.personality || ''}\n定位: ${c.role || ''}`)
      .join('\n\n');
    await RAGFactory.indexDocument(`${novelId}-characters`, characterText, { chunkSize: 1000 });
  }

  // ── 场景生成 ──

  private async generateScenes(
    structuredNovel: import('@/lib/types').NormalizedNovel,
    novelId: string,
    onProgress?: GenerationProgress
  ): Promise<ScriptScene[]> {
    const scenes: ScriptScene[] = [];
    const total = structuredNovel.scenes.length;

    for (let i = 0; i < total; i++) {
      const novelScene = structuredNovel.scenes[i];
      onProgress?.('scene', `生成场景 ${i + 1}/${total}: ${novelScene.heading}`);

      try {
        // RAG 检索相关上下文
        const ragResult = await RAGFactory.query(novelScene.heading, {
          topK: 3,
          filter: { sourceId: `${novelId}-scene-${i}` },
        });

        // 构建 LLM prompt
        const characterContext = structuredNovel.characters
          .slice(0, 10)
          .map((c) => `${c.name}(${c.role || '角色'}): ${c.description || ''}`)
          .join('\n');

        const userPrompt = `请将以下小说场景转化为剧本格式:

【场景】${novelScene.heading}
【原文】${novelScene.raw_text?.slice(0, 2000) || '无原文'}
【相关上下文】${ragResult.context.slice(0, 1000)}
【涉及角色】${characterContext}
【地点】${(structuredNovel.locations || []).slice(0, 5).map((l) => l.name).join('、')}

请生成剧本内容，包含:
- action: 动作/环境描述
- character: 角色对话 (如有)
- transition: 转场 (如需要)

返回 JSON 数组格式: [{"type": "action", "text": "..."}, {"type": "character", "name": "...", "dialogue": "..."}]`;

        const result = await LLMFactory.chat(
          [
            { role: 'system', content: SCENE_GENERATION_SYSTEM },
            { role: 'user', content: userPrompt },
          ],
          { temperature: 0.7, maxTokens: 2000 }
        );

        // 解析 LLM 返回的场景内容
        const content = this.parseSceneContent(result.content, novelScene);

        scenes.push({
          id: `scene-gen-${i + 1}`,
          heading: novelScene.heading,
          content,
          notes: `由 AI+RAG 策略自动生成 (${new Date().toLocaleString('zh-CN')})`,
        });
      } catch {
        // LLM 不可用时返回占位内容
        scenes.push({
          id: `scene-gen-${i + 1}`,
          heading: novelScene.heading,
          content: [
            {
              type: 'action',
              text: `[待 AI 生成] 场景: ${novelScene.heading}。请配置 LLM Provider 后进行实际生成。`,
            },
          ],
          notes: 'LLM 未配置，此为占位内容',
        });
      }
    }

    return scenes;
  }

  /**
   * 解析 LLM 返回的场景内容 JSON
   */
  private parseSceneContent(
    llmResponse: string,
    novelScene: import('@/lib/types').Scene
  ): SceneContent[] {
    try {
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: Record<string, unknown>) => {
            if (item.type === 'character') {
              return {
                type: 'character' as const,
                name: (item.name as string) || '角色',
                dialogue: (item.dialogue as string) || '',
                parenthetical: item.parenthetical as string | undefined,
              };
            }
            if (item.type === 'transition') {
              return { type: 'transition' as const, text: (item.text as string) || '' };
            }
            if (item.type === 'shot') {
              return { type: 'shot' as const, text: (item.text as string) || '' };
            }
            // 默认 action
            return { type: 'action' as const, text: (item.text as string) || '' };
          });
        }
      }
    } catch {
      // JSON 解析失败，将 LLM 返回的所有内容作为一个 action
    }

    return [
      {
        type: 'action',
        text: llmResponse.slice(0, 1000) || `[未解析] ${novelScene.heading}`,
      },
    ];
  }
}
