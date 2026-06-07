# AI4N2S 系统概述

## 架构

```
UI 层 (Next.js App Router)
  └── 页面: / /novels /novels/[id] /scripts /scripts/[id]
  └── 组件: layout/ ui/ novels/

API 层 (Route Handlers)
  └── /api/novels/* /api/scripts/* /api/pipeline/*

服务层
  └── NovelService, ScriptService, Pipeline 执行器

数据层
  └── SQLite (元数据) + 文件系统 (源文件、剧本、结构化数据)

模块层
  └── LLM, RAG, FileProcessor, OCR (策略模式，可替换)
```

## 目录结构

```
ai4n2s/
├── app/                       # Next.js 页面
│   ├── api/                   # API 路由
│   │   ├── novels/            # 小说 CRUD + 文件上传 + 结构化数据
│   │   ├── scripts/           # 剧本 CRUD + YAML 导入导出
│   │   └── pipeline/          # 结构化和生成管线
│   ├── novels/
│   │   ├── page.tsx           # 小说管理页
│   │   └── [id]/page.tsx      # 结构化数据编辑器（表单 + JSON 双模式）
│   ├── scripts/
│   │   ├── page.tsx           # 全部剧本列表
│   │   └── [id]/page.tsx      # 剧本详情 + 精细编辑 + 生成
│   ├── layout.tsx             # 根布局
│   ├── page.tsx               # 首页仪表盘
│   └── globals.css            # 设计 Token
├── components/
│   ├── layout/                # AppLayout, Sidebar, SidebarToggle
│   ├── ui/                    # Button, Modal, Card, Badge, Input, StatCard
│   └── novels/                # 小说相关组件
├── lib/
│   ├── types.ts               # 全部 TS 类型定义
│   ├── db.ts                  # SQLite 初始化 + 建表
│   ├── novel-service.ts       # 小说业务逻辑
│   ├── script-service.ts      # 剧本业务逻辑 + YAML
│   ├── pipeline/              # 管线类型 + 执行器
│   ├── strategies/            # 策略实现
│   └── modules/               # 可替换核心模块
├── scripts/seed.ts            # 示例数据填充
├── docs/                      # 项目文档
└── data/                      # 运行时数据 (gitignore)
```

## 数据模型

### 小说 (novels 表)
id, title, author, created_at, updated_at, status, source_files (JSON), normalized_path

### 剧本 (scripts 表)
id, novel_id (FK), version, format, file_path, yaml_path, created_at, updated_at, generation_config (JSON)

### 结构化小说 (NormalizedNovel, JSON 存储)
metadata, characters[], locations[], plot_summary, chapters[], scenes[]

### 剧本内容 (ScriptYAML, JSON 存储)
metadata, characters[], scenes[]（每场景含 heading, content[], notes, tags）

## 两条管线

### 管线 1: 小说 → 结构化 JSON
提取源文件文本 → 执行结构化策略 → 保存 normalized.json → 更新数据库。

### 管线 2: 结构化 JSON → 剧本
加载结构化数据 → 执行生成策略 → 创建剧本记录 + 文件。

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.2.7 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| 数据库 | better-sqlite3 | 12.x |
| YAML | yaml | 2.x |
| UUID | uuid | 14.x |
