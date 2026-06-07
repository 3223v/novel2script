# AI4N2S 系统概述

## 架构

```
UI 层 (Next.js App Router)
  └── 页面: / /novels /novels/[id] /novels/[id]/read /scripts /scripts/[id]

API 层 (Route Handlers)
  └── /api/novels/* /api/scripts/* /api/pipeline/*

服务层
  └── NovelService, ScriptService, Pipeline 执行器, Enhancement 管线

数据层
  └── SQLite + 文件系统（小说和剧本为独立实体）

模块层
  └── LLM, RAG, FileProcessor, OCR（策略模式，可替换）
```

## 核心设计

- **小说和剧本解耦**：剧本是独立实体，可关联 0 或 1 部小说
- **一对多可选关系**：一部小说可有多个关联剧本
- **独立剧本**：剧本管理页可直接创建不关联任何小说的独立剧本，后续通过下拉框关联
- **小说管理页创建剧本**：默认关联当前小说

## 目录结构

```
ai4n2s/
├── app/
│   ├── api/
│   │   ├── novels/           # 小说 CRUD + 文件 + 结构化数据
│   │   ├── scripts/          # 剧本 CRUD + YAML + 关联管理
│   │   └── pipeline/         # 结构化/生成/增强 SSE 流式管线
│   ├── novels/               # 小说管理 + 结构化编辑器 + 阅读器
│   ├── scripts/              # 剧本管理 + 编辑器 + 生成
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 仪表盘
│   └── globals.css           # 设计 Token
├── components/
│   ├── layout/               # AppLayout, Sidebar, SidebarToggle
│   ├── ui/                   # Button, Modal, Card, Badge, Input, StatCard
│   └── novels/               # 小说组件
├── lib/
│   ├── types.ts, db.ts
│   ├── novel-service.ts, script-service.ts
│   ├── pipeline/             # 管线类型 + 执行器
│   ├── strategies/           # 结构化策略 (5) + 生成策略 (3)
│   └── modules/              # LLM, RAG, FileProcessor, OCR
├── docs/                     # 项目文档
├── scripts/seed.ts           # 示例数据
└── data/                     # 运行时数据
```

## 管线

### 结构化管线
5 个策略: default / regex / ai-workflow / epub / langgraph

### 剧本生成管线
3 个策略: default / ai-rag / llm-direct

### AI 增强管线（新增）
对已有结构化数据补充缺失字段（摘要/角色描述等）

### SSE 流式推送
所有管线支持 `GET /stream` 端点，通过 EventSource 实时推送进度

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · SQLite · YAML · adm-zip · jsdom
