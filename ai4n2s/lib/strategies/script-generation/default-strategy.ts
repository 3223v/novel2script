import type {
  ScriptGenerationStrategy,
  ScriptGenerationInput,
  GenerationProgress,
} from '@/lib/pipeline/types';
import type { ScriptYAML, ScriptScene } from '@/lib/types';

/**
 * 默认剧本生成策略
 *
 * 从结构化小说中提取元数据和角色，为每章创建一个占位场景。
 * 不生成实际剧本内容 — 作为快速初始化和 fallback。
 */
export class DefaultScriptGenerationStrategy implements ScriptGenerationStrategy {
  readonly name = 'default';
  readonly description = '默认策略 — 生成空白剧本模板，元数据来自结构化小说';

  async execute(
    input: ScriptGenerationInput,
    onProgress?: GenerationProgress
  ): Promise<ScriptYAML> {
    const { novel, structuredNovel, version } = input;

    onProgress?.('start', '构建空白剧本模板...');

    // 元数据
    onProgress?.('metadata', '填充剧本元数据...');
    const metadata = {
      title: `${novel.title} - 剧本`,
      author: novel.author || structuredNovel.metadata.author || '未知',
      based_on: novel.title,
      version: version || 'v1.0',
      date: new Date().toISOString().split('T')[0],
      logline: structuredNovel.plot_summary?.slice(0, 100) || '',
      genre: [],
    };

    // 角色列表
    onProgress?.('characters', '映射角色...');
    const characters = (structuredNovel.characters || []).map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || char.personality || '',
    }));

    // 场景 — 每章一个占位场景
    onProgress?.('scenes', '创建场景骨架...');
    const scenes: ScriptScene[] = (structuredNovel.chapters || []).map((ch, idx) => ({
      id: `scene-default-${idx + 1}`,
      heading: ch.title || `场景 ${idx + 1}`,
      content: [{ type: 'action' as const, text: `[待生成] ${ch.summary || ch.title}` }],
      notes: ch.summary || '',
    }));

    if (scenes.length === 0) {
      scenes.push({
        id: 'scene-default-1',
        heading: '第一场',
        content: [{ type: 'action' as const, text: '[剧本内容待生成]' }],
        notes: '默认空白场景',
      });
    }

    onProgress?.('done', '空白剧本模板构建完成');

    return { script: { metadata, characters, scenes } };
  }
}
