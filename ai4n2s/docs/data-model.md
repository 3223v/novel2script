# 数据存储层文档

## 概述

AI4N2S 的数据层由三部分组成：

| 层 | 技术 | 存储内容 |
|---|------|---------|
| 关系型数据库 | SQLite (better-sqlite3, WAL 模式) | 小说和剧本的元数据 |
| 文件系统 | Node.js fs | 源文件、剧本文件、结构化数据 |
| 内存 | Map | 策略注册表、模块单例 |

## 一、数据库

### 位置

`data/novels.db`

### 设计理念

- **小说和剧本是独立实体**：剧本不再依赖小说存在
- **剧本可关联小说**：`scripts.novel_id` 可为 NULL
- **小说可独立存在**：一部小说可有零个或多个关联剧本
- **一对多可选关系**：一部小说可有多个剧本，一个剧本可关联 0 或 1 部小说

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
| normalized_path | TEXT | | 结构化数据文件路径 |

#### scripts

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| novel_id | TEXT | **NULLABLE** | 关联小说 ID（NULL = 独立剧本） |
| version | TEXT | NOT NULL | 版本号 |
| format | TEXT | DEFAULT 'json' | 存储格式 |
| file_path | TEXT | NOT NULL | JSON 文件路径 |
| yaml_path | TEXT | | YAML 导出路径 |
| created_at | INTEGER | NOT NULL | 创建时间戳 (ms) |
| updated_at | INTEGER | NOT NULL | 更新时间戳 (ms) |
| generation_config | TEXT | DEFAULT '{}' | 生成配置 |

**索引**: `CREATE INDEX idx_scripts_novel_id ON scripts(novel_id)`

**注意**: 不再有 `FOREIGN KEY` 约束 — 删除小说不会自动删除剧本。

## 二、文件存储

```
data/storage/
├── {novelId}/                   # 关联小说的剧本
│   ├── sources/                 # 源文件
│   ├── scripts/                 # 剧本 JSON/YAML
│   └── normalized.json          # 结构化数据
└── standalone/                  # 独立剧本（不关联任何小说）
    └── scripts/
        └── {scriptId}.json
```

## 三、JSON 数据结构

### NormalizedNovel（结构化小说）

以章节数组为核心：

```typescript
interface NormalizedNovel {
  metadata: { title, author, word_count, analysis_date };
  characters: Array<{ id, name, aliases?, description?, personality?, role? }>;
  plot_summary: string;
  chapters: Array<{
    index: number; title: string; summary: string;
    content: string; characters: string[]; locations: string[];
  }>;
}
```

### ScriptYAML（剧本）

```typescript
interface ScriptYAML {
  script: {
    metadata: { title, author, based_on, version, date, logline?, genre? };
    characters?: Array<{ id, name, description? }>;
    scenes: Array<{ id, heading, content: SceneContent[], notes?, tags? }>;
  };
}
```

### Script 数据库行

```json
{ "id": "uuid", "novel_id": null, "version": "v1.0", "format": "json", ... }
```
`novel_id` 为 `null` 时表示独立剧本。

## 四、数据流转

```
源文件 → 管线 1 (结构化) → normalized.json
                                  ↓
                          剧本生成 (管线 2) → {scriptId}.json
                                  ↑
                          独立剧本可不依赖小说
```

## 五、备份

- SQLite: 备份 `data/novels.db`
- 文件: 备份 `data/storage/` 目录
