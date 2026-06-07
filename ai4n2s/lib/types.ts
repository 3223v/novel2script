// ══════════════════════════════════════════════════════════
// 小说相关类型
// ══════════════════════════════════════════════════════════

export interface Novel {
  id: string;
  title: string;
  author: string;
  created_at: number;
  updated_at: number;
  status: 'uploading' | 'analyzing' | 'ready' | 'error';
  source_files: SourceFile[];
  normalized_path?: string;
}

export interface SourceFile {
  name: string;
  path: string;
  type: string;
}

// ══════════════════════════════════════════════════════════
// 角色
// ══════════════════════════════════════════════════════════

export interface Character {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  personality?: string;
  role?: string;
}

// ══════════════════════════════════════════════════════════
// 结构化小说 — 以章节为核心的通用表示
// ══════════════════════════════════════════════════════════

/**
 * NormalizedNovel
 *
 * 通用小说中间表示，以章节数组为核心数据结构。
 * 元数据和角色为全书级别，其余信息挂载在章节内。
 */
export interface NormalizedNovel {
  /** 全书元数据 */
  metadata: NovelMetadata;

  /** 全书角色列表 */
  characters: Character[];

  /** 全书情节摘要 */
  plot_summary: string;

  /** 章节数组 — 核心数据结构 */
  chapters: NovelChapter[];
}

export interface NovelMetadata {
  title: string;
  author: string;
  /** 总字数（含标点，不含空格） */
  word_count: number;
  /** 分析时间戳 */
  analysis_date: number;
}

/**
 * NovelChapter
 *
 * 一个章节的完整结构化表示。
 * 包含章节级元信息、正文内容、以及该章节涉及的角色和地点。
 */
export interface NovelChapter {
  /** 章节序号（从 0 开始） */
  index: number;

  /** 章节标题（如 "第一章 初见"） */
  title: string;

  /** 章节摘要（AI 或人工生成） */
  summary: string;

  /** 章节正文全文 */
  content: string;

  /** 该章节出现的角色名称列表 */
  characters: string[];

  /** 该章节涉及的地点名称列表 */
  locations: string[];
}

// 兼容旧版类型别名（渐进迁移用）
export type Chapter = { index: number; title: string; summary: string };

// ══════════════════════════════════════════════════════════
// 剧本相关类型
// ══════════════════════════════════════════════════════════

export interface Script {
  id: string;
  /** 关联的小说 ID（可为 null — 独立剧本） */
  novel_id: string | null;
  version: string;
  format: string;
  file_path: string;
  yaml_path?: string;
  created_at: number;
  updated_at: number;
  generation_config: Record<string, unknown>;
}

export interface ScriptYAML {
  script: {
    metadata: ScriptMetadata;
    characters?: ScriptCharacter[];
    scenes: ScriptScene[];
  };
}

export interface ScriptMetadata {
  title: string;
  author: string;
  based_on: string;
  version: string;
  date: string;
  logline?: string;
  genre?: string[];
}

export interface ScriptCharacter {
  id: string;
  name: string;
  description?: string;
}

export interface ScriptScene {
  id: string;
  heading: string;
  content: SceneContent[];
  notes?: string;
  tags?: string[];
}

export type SceneContent =
  | { type: 'action'; text: string }
  | { type: 'character'; name: string; parenthetical?: string; dialogue: string }
  | { type: 'transition'; text: string }
  | { type: 'shot'; text: string };

// ══════════════════════════════════════════════════════════
// API 响应
// ══════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
