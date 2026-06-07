# AI4N2S — 小说转剧本系统

基于 Next.js 16 + SQLite + YAML 构建。采用策略模式实现两条处理管线，支持模块化扩展。

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.7 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| 数据库 | better-sqlite3 (WAL 模式) | 12.x |
| 序列化 | yaml | 2.x |
| ID 生成 | uuid | 14.x |

## 设计系统

白色背景 + 黑色 1px 实线边框的复古线框风格。无圆角，monospace 字体用于标题和技术元素。黑色边框偏移阴影表示层级深度。hover 时反转颜色（黑底白字）。

核心 CSS 类：`wireframe-border`（1px 黑边）、`wireframe-shadow`（4px 偏移阴影）。

## 项目结构

```
ai4n2s/
├── app/                        # Next.js 页面
│   ├── api/                    # API 路由
│   │   ├── novels/             # 小说 CRUD + 文件上传
│   │   ├── scripts/            # 剧本 CRUD + YAML 导入导出
│   │   └── pipeline/           # 结构化和生成管线
│   ├── novels/page.tsx         # 小说管理页
│   ├── scripts/                # 剧本管理模块
│   │   ├── page.tsx            # 剧本列表
│   │   └── [id]/page.tsx       # 剧本详情 + 编辑 + 生成
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页仪表盘
│   └── globals.css             # 设计系统 Token
├── components/
│   ├── layout/                 # AppLayout, Sidebar, SidebarToggle
│   ├── ui/                     # Button, Modal, Card, Badge, Input, StatCard
│   └── novels/                 # 小说相关组件
├── lib/
│   ├── types.ts                # 全部 TS 类型定义
│   ├── db.ts                   # SQLite 初始化 + 建表
│   ├── novel-service.ts        # 小说业务逻辑
│   ├── script-service.ts       # 剧本业务逻辑 + YAML 处理
│   ├── pipeline/               # 管线类型 + 执行器 + 策略注册表
│   ├── strategies/             # 策略实现
│   │   ├── novel-normalization/  # default, regex, ai-workflow
│   │   └── script-generation/    # default, ai-rag
│   └── modules/                # 核心模块（可替换）
│       ├── llm.ts              # LLM 抽象层
│       ├── rag.ts              # 检索增强生成
│       ├── file-processor.ts   # 文件文本提取
│       └── ocr.ts              # OCR 抽象层
├── scripts/seed.ts             # 示例数据填充
├── docs/                       # 项目文档
└── data/                       # 运行时数据（gitignore）
    ├── novels.db               # SQLite 数据库
    └── storage/{novelId}/      # 文件存储
        ├── sources/            # 上传的源文件
        ├── scripts/            # 剧本 JSON/YAML
        └── normalized.json     # 结构化小说数据
```

## 两条处理管线

### 管线 1：小说 → 结构化 JSON
从源文件提取文本 → 执行结构化策略 → 保存 `normalized.json` → 更新数据库状态。
可用策略：`default`（仅元数据）、`regex`（正则匹配）、`ai-workflow`（LLM 逐步分析）。

### 管线 2：结构化 JSON → 剧本
加载结构化数据 → 执行生成策略 → 创建剧本记录 + 文件。
可用策略：`default`（空模板）、`ai-rag`（RAG 检索 + LLM 逐场景生成）。

## 模块扩展方式

```typescript
// 切换 LLM 后端
LLMFactory.setProvider(new OpenAICompatibleProvider({ baseUrl, apiKey }));

// 切换 RAG 后端
RAGFactory.setProvider(new ChromaRAGProvider(/* config */));

// 添加新策略 — 自动出现在 UI 下拉菜单中
registerNovelStructuringStrategy(new MyCustomStrategy());
```

## 常用命令

```bash
npm run dev      # 启动开发服务器 → http://localhost:3000
npm run build    # 生产构建
npm run seed     # 填充示例数据
```

## 编码规范

- 所有面向用户的文本、代码注释、文档均使用中文
- 所有组件使用 `'use client'` 指令（交互式组件）
- API 响应统一格式：`{ success: boolean, data?: T, error?: string }`
- 策略模式：实现接口 → 注册 → 自动可用
- 工厂模式：LLM/RAG/OCR 模块支持运行时替换
- 样式：Tailwind v4 `@import "tailwindcss"` 语法，配合自定义工具类
