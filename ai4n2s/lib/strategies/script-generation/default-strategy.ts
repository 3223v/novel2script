/**
 * 默认剧本生成策略
 *
 * 返回一个包含基本元数据和空场景的 ScriptYAML。
 * 填充小说的基础信息（标题、作者、版本号），但不生成内容。
 * 作为其他生成策略的 fallback 或快速初始化。
 */

import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene } from '@/lib/types';

export class DefaultScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'default';
  readonly description = '默认剧本生成策略 — 返回空白的剧本模板，仅填充元数据';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;

    onProgress?.('start', '开始构建空白剧本模板...');

    // 构建元数据
    onProgress?.('metadata', '填充剧本元数据...');
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary
        ? structuredNovel.plot_summary.slice(0, 100)
        : '',
      genre: [],
    };

    // 构建角色列表 (从结构化小说中复制)
    onProgress?.('characters', '映射角色列表...');
    const characters = (structuredNovel.characters || []).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 构建空场景列表 (为每个小说章节创建一个占位场景)
    onProgress?.('scenes', '创建场景骨架...');
    const scenes: ScriptScene[] = (structuredNovel.chapters || []).map((chapter, idx) => ({
      id: `scene-default-${idx + 1}`,
      heading: chapter.title || `场景 ${idx + 1}`,
      content: [
        {
          type: 'action' as const,
          text: `[待生成] ${chapter.summary || chapter.title}`,
        },
      ],
      notes: chapter.summary || '',
    }));

    // 如果没有章节，创建一个空场景
    if (scenes.length === 0) {
      scenes.push({
        id: 'scene-default-1',
        heading: '第一场',
        content: [
          {
            type: 'action' as const,
            text: '[剧本内容待生成 — 请使用 AI+RAG 策略或手动编写]',
          },
        ],
        notes: '默认空白场景',
      });
    }

    onProgress?.('done', '空白剧本模板构建完成');

    return {
      script: {
        metadata,
        characters,
        scenes,
      },
    };
  }
}
