# 数据存储层文档

## 概述

AI4N2S 的数据层由三部分组成：

| 层 | 技术 | 存储内容 |
|---|------|---------|
| 关系型数据库 | SQLite (better-sqlite3, WAL 模式) | 小说和剧本的元数据 |
| 文件系统 | Node.js fs | 源文件、剧本内容、结构化数据 |
| 内存 | Map | 策略注册表、模块单例 |

## 一、数据库

### 位置

`data/novels.db`

### ER 关系

```
novels (1) ──→ (N) scripts
  │                │
  │                └── file_path → storage/{novelId}/scripts/{scriptId}.json
  │
  └── normalized_path → storage/{novelId}/normalized.json
```

### 表结构

#### novels

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| title | TEXT | NOT NULL | 小说标题 |
| author | TEXT | | 作者 |
| created_at | INTEGER | NOT NULL | 创建时间戳 (ms) |
| updated_at | INTEGER | NOT NULL | 更新时间戳 (ms) |
| status | TEXT | DEFAULT 'uploading' | uploading / analyzing / ready / error |
| source_files | TEXT | DEFAULT '[]' | JSON 序列化的 `SourceFile[]` |
| normalized_path | TEXT | | 结构化数据文件相对路径 |

#### scripts

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| novel_id | TEXT | NOT NULL, FK→novels.id | 关联小说 |
| version | TEXT | NOT NULL | 版本号，如 "v1.0" |
| format | TEXT | DEFAULT 'json' | 存储格式 |
| file_path | TEXT | NOT NULL | JSON 文件相对路径 |
| yaml_path | TEXT | | YAML 文件相对路径（导出时生成） |
| created_at | INTEGER | NOT NULL | 创建时间戳 (ms) |
| updated_at | INTEGER | NOT NULL | 更新时间戳 (ms) |
| generation_config | TEXT | DEFAULT '{}' | JSON 序列化的生成配置 |

**索引**: `CREATE INDEX idx_scripts_novel_id ON scripts(novel_id)`

**外键**: `novel_id REFERENCES novels(id) ON DELETE CASCADE`

## 二、文件存储

### 根目录

```
data/storage/{novelId}/
```

### 目录结构

```
data/storage/{novelId}/
├── sources/                          # 用户上传的源文件
│   ├── {uuid}.txt                    # TXT 文件 (UUID 重命名)
│   ├── {uuid}.pdf                    # PDF 文件
│   └── {uuid}.docx                   # DOCX 文件
├── scripts/                          # 剧本文件
│   ├── {scriptId}.json               # 剧本 JSON（主存储格式）
│   └── {scriptId}.yaml               # 剧本 YAML（导出时生成）
└── normalized.json                   # 结构化小说（核心中间文件）
```

### 设计原则

- 源文件使用 UUID 重命名，保留原始扩展名，原始文件名存储在数据库 `source_files` JSON 中
- 每个剧本以 JSON 为主存储格式，YAML 按需导出
- `normalized.json` 是管线 1 的输出和管线 2 的输入
- 删除小说时一并清理整个 `storage/{novelId}/` 目录

## 三、JSON 数据结构

### 3.1 NormalizedNovel — 结构化小说

**设计理念**: 以 **章节数组** 为核心的通用小说中间表示。每个章节是自包含的数据单元，包含正文、摘要、角色和地点。

```typescript
interface NormalizedNovel {
  metadata: {
    title: string;          // 书名
    author: string;         // 作者
    word_count: number;     // 总字数（不含空格和标点）
    analysis_date: number;  // 分析时间戳 (ms)
  };
  characters: Character[];  // 全书角色列表
  plot_summary: string;     // 全书情节摘要
  chapters: NovelChapter[]; // 【核心】章节数组
}
```

#### Character

```typescript
interface Character {
  id: string;             // 唯一标识，如 "char-1"
  name: string;           // 角色名
  aliases?: string[];     // 别名/外号
  description?: string;   // 外貌 / 背景描述
  personality?: string;   // 性格特征
  role?: string;          // 主角 / 配角 / 龙套
}
```

#### NovelChapter — 核心结构

```typescript
interface NovelChapter {
  index: number;            // 章节序号（从 0 开始）
  title: string;            // 章节标题，如 "第三章 初见"
  summary: string;          // 章节摘要（AI 或人工编写）
  content: string;          // 章节正文全文
  characters: string[];     // 本章出现的角色名称
  locations: string[];      // 本章涉及的地点名称
  scenes?: ChapterScene[];  // 可选的章节内子场景切分
}
```

#### ChapterScene — 子场景

```typescript
interface ChapterScene {
  heading: string;          // 场景标题，如 "外. 花园 - 黄昏"
  content: string;          // 场景正文
  summary?: string;         // 场景摘要
  characters: string[];     // 场景中出现的角色
  locations: string[];      // 场景中涉及的地点
}
```

#### 完整示例

```json
{
  "metadata": {
    "title": "围城",
    "author": "钱钟书",
    "word_count": 238000,
    "analysis_date": 1717276800000
  },
  "characters": [
    {
      "id": "c1",
      "name": "方鸿渐",
      "aliases": ["鸿渐"],
      "description": "留学归国青年",
      "personality": "优柔寡断、自命清高",
      "role": "主角"
    },
    {
      "id": "c2",
      "name": "孙柔嘉",
      "role": "主角"
    }
  ],
  "plot_summary": "《围城》是中国现代文学史上的一部经典讽刺小说。故事以方鸿渐为中心，讲述了抗战初期知识分子群体的生活百态...",
  "chapters": [
    {
      "index": 0,
      "title": "第一章",
      "summary": "方鸿渐留学归国，在船上结识苏文纨。",
      "content": "红海早过了，船在印度洋面上开驶着。但是太阳依然不饶人地迟落早起，侵占去大部分的夜...",
      "characters": ["方鸿渐", "苏文纨", "鲍小姐"],
      "locations": ["轮船", "印度洋"],
      "scenes": [
        {
          "heading": "甲板上",
          "content": "太阳依然不饶人地迟落早起...",
          "summary": "方鸿渐在甲板上与苏文纨交谈",
          "characters": ["方鸿渐", "苏文纨"],
          "locations": ["甲板"]
        }
      ]
    }
  ]
}
```

### 3.2 ScriptYAML — 剧本

```typescript
interface ScriptYAML {
  script: {
    metadata: {
      title: string;          // 剧本标题
      author: string;         // 编剧
      based_on: string;       // 原著
      version: string;        // 版本号
      date: string;           // 日期 (YYYY-MM-DD)
      logline?: string;       // 一句话梗概
      genre?: string[];       // 类型标签
    };
    characters?: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    scenes: Array<{
      id: string;
      heading: string;        // 场景标题
      content: SceneContent[];
      notes?: string;
      tags?: string[];
    }>;
  };
}

// SceneContent 联合类型:
//   { type: "action", text: string }
//   | { type: "character", name: string, parenthetical?: string, dialogue: string }
//   | { type: "transition", text: string }
//   | { type: "shot", text: string }
```

### 3.3 Novel 与 Script 的 DB 行格式

#### Novel 行

```json
{
  "id": "uuid",
  "title": "围城",
  "author": "钱钟书",
  "created_at": 1700000000000,
  "updated_at": 1700000000000,
  "status": "ready",
  "source_files": [
    { "name": "围城.txt", "path": "sources/abc123.txt", "type": "text/plain" }
  ],
  "normalized_path": "storage/uuid/normalized.json"
}
```

#### Script 行

```json
{
  "id": "uuid",
  "novel_id": "uuid",
  "version": "v1.0",
  "format": "json",
  "file_path": "uuid/scripts/def456.json",
  "yaml_path": null,
  "created_at": 1700000000000,
  "updated_at": 1700000000000,
  "generation_config": {}
}
```

## 四、数据流转

```
源文件 (PDF / DOCX / TXT)
     │
     │  FileProcessor.extractFromFile()
     ▼
原始文本
     │
     │  管线 1: NovelStructuringPipeline
     │  策略: default / regex / ai-workflow
     ▼
normalized.json  ←── 人工编辑: /novels/[id] (表单 / JSON 双模式)
     │
     │  管线 2: ScriptGenerationPipeline
     │  策略: default / ai-rag
     ▼
{scriptId}.json  ←── 人工编辑: /scripts/[id] (精细编辑)
     │
     │  GET /api/scripts/{id}/export-yaml
     ▼
{scriptId}.yaml
```

## 五、文件位置速查

| 数据 | 位置 | 格式 |
|------|------|------|
| 小说元数据 | `data/novels.db` → novels 表 | SQLite |
| 剧本元数据 | `data/novels.db` → scripts 表 | SQLite |
| 源文件 | `data/storage/{novelId}/sources/{uuid}.ext` | 原始格式 |
| 结构化小说 | `data/storage/{novelId}/normalized.json` | JSON |
| 剧本内容 | `data/storage/{novelId}/scripts/{scriptId}.json` | JSON |
| 剧本导出 | `data/storage/{novelId}/scripts/{scriptId}.yaml` | YAML |

## 六、备份与恢复

- SQLite: 备份 `data/novels.db` 即可（单文件）
- 文件: 备份 `data/storage/` 目录
- 恢复: 同时恢复 `.db` 文件和 `storage/` 目录，保持相对路径一致
