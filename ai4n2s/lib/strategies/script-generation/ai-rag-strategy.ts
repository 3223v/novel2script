import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene, SceneContent } from '@/lib/types';
import { LLMFactory } from '@/lib/modules/llm';
import { RAGFactory } from '@/lib/modules/rag';

const SCENE_PROMPT = `你是一位专业编剧。将以下小说章节转化为标准剧本格式。

格式:
- action: 第三人称动作/环境描述
- character: 角色对话，包含 name(角色名)、dialogue(台词)、可选 parenthetical(情绪说明)
- transition: 转场提示
- shot: 镜头指示

请以 JSON 数组返回。`;

/**
 * AI + RAG 剧本生成策略
 *
 * 为每章建立 RAG 索引，检索相关角色信息，调用 LLM 将叙事转化为剧本格式。
 * 配置真实 LLM Provider 后产出实际剧本内容。
 */
export class AIRAGScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'ai-rag';
  readonly description = 'AI+RAG 策略 — 检索增强 + LLM 逐章生成专业剧本';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;

    onProgress?.('start', 'AI+RAG 剧本生成开始...');

    // 1. RAG 索引
    onProgress?.('indexing', '建立 RAG 索引...');
    await this.buildIndex(novel.id, structuredNovel);

    // 2. 元数据
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary?.slice(0, 100) || '',
      genre: [],
    };

    // 3. 角色
    const characters = (structuredNovel.characters || []).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 4. 逐章生成
    onProgress?.('scenes', `为 ${structuredNovel.chapters.length} 章生成剧本...`);
    const scenes = await this.generateScenes(structuredNovel, novel.id, onProgress);

    onProgress?.('done', `剧本生成完成，共 ${scenes.length} 个场景`);

    return { script: { metadata, characters, scenes } };
  }

  private async buildIndex(novelId: string, sn: import('@/lib/types').NormalizedNovel): Promise<void> {
    await RAGFactory.indexDocument(`${novelId}-plot`, sn.plot_summary || '', { chunkSize: 1000 });

    for (const ch of sn.chapters) {
      await RAGFactory.indexDocument(`${novelId}-ch-${ch.index}`, ch.content || '', { chunkSize: 2000 });
    }

    const charText = (sn.characters || []).map((c) =>
      `角色: ${c.name} | 别名: ${(c.aliases || []).join(', ')} | 描述: ${c.description || ''} | 性格: ${c.personality || ''} | 定位: ${c.role || ''}`
    ).join('\n');
    await RAGFactory.indexDocument(`${novelId}-characters`, charText, { chunkSize: 1000 });
  }

  private async generateScenes(
    sn: import('@/lib/types').NormalizedNovel,
    novelId: string,
    onProgress?: GenerationProgress
  ): Promise<ScriptScene[]> {
    const scenes: ScriptScene[] = [];

    for (let i = 0; i < sn.chapters.length; i++) {
      const ch = sn.chapters[i];
      onProgress?.('scene', `生成场景 ${i + 1}/${sn.chapters.length}: ${ch.title}`);

      try {
        const ragResult = await RAGFactory.query(ch.title, { topK: 3 });
        const characterCtx = (sn.characters || []).slice(0, 10)
          .map((c) => `${c.name}(${c.role || ''}): ${c.description || ''}`)
          .join('\n');

        const prompt = `请将以下小说章节转化为剧本:

【章节】${ch.title}
【原文】${ch.content?.slice(0, 2000) || '无'}
【相关上下文】${ragResult.context.slice(0, 1000)}
【角色】${characterCtx}
【地点】${(ch.locations || []).slice(0, 5).join('、')}`;

        const result = await LLMFactory.chat(
          [
            { role: 'system', content: SCENE_PROMPT },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.7, maxTokens: 2000 }
        );

        scenes.push({
          id: `scene-gen-${i + 1}`,
          heading: ch.title,
          content: this.parseContent(result.content, ch.title),
          notes: `AI+RAG 自动生成 (${new Date().toLocaleString('zh-CN')})`,
        });
      } catch {
        scenes.push({
          id: `scene-gen-${i + 1}`,
          heading: ch.title,
          content: [{ type: 'action', text: `[待 AI 生成] ${ch.title}。请先配置 LLM Provider。` }],
          notes: 'LLM 未配置',
        });
      }
    }

    return scenes;
  }

  private parseContent(llmResponse: string, fallbackHeading: string): SceneContent[] {
    try {
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: Record<string, unknown>) => {
            if (item.type === 'character') {
              return { type: 'character' as const, name: (item.name as string) || '角色', dialogue: (item.dialogue as string) || '', parenthetical: item.parenthetical as string | undefined };
            }
            if (item.type === 'transition') return { type: 'transition' as const, text: (item.text as string) || '' };
            if (item.type === 'shot') return { type: 'shot' as const, text: (item.text as string) || '' };
            return { type: 'action' as const, text: (item.text as string) || '' };
          });
        }
      }
    } catch { /* 解析失败，fallback */ }

    return [{ type: 'action', text: llmResponse.slice(0, 1000) || `[未解析] ${fallbackHeading}` }];
  }
}
