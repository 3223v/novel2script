// 小说相关类型
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

// 剧本相关类型
export interface Script {
  id: string;
  novel_id: string;
  version: string;
  format: string;
  file_path: string;
  yaml_path?: string;
  created_at: number;
  updated_at: number;
  generation_config: Record<string, unknown>;
}

// 结构化小说中间表示
export interface NormalizedNovel {
  metadata: {
    title: string;
    author: string;
    word_count: number;
    analysis_date: number;
  };
  characters: Character[];
  locations: Location[];
  plot_summary: string;
  chapters: Chapter[];
  scenes: Scene[];
}

export interface Character {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  personality?: string;
  role?: string;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
}

export interface Chapter {
  index: number;
  title: string;
  summary: string;
}

export interface Scene {
  chapter_index: number;
  heading: string;
  raw_text: string;
  characters: string[];
  locations: string[];
}

// 剧本 YAML 结构
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

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
