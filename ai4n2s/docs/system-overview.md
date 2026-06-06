# AI4N2S 数据管理系统 - 系统概述

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端界面 (Next.js)                     │
│                    http://localhost:3000                   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    API 路由层                            │
│              /api/novels/*, /api/scripts/*               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   服务层                                 │
│         NovelService, ScriptService                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   数据层                                 │
│     SQLite (元数据) + 文件系统 (源文件/剧本)              │
└─────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai4n2s/
├── app/
│   ├── api/                    # API 路由
│   │   ├── novels/             # 小说 API
│   │   │   ├── route.ts        # GET/POST 小说列表
│   │   │   └── [id]/
│   │   │       ├── route.ts    # GET/PATCH/DELETE 单个小说
│   │   │       └── files/
│   │   │           └── route.ts # POST 上传文件
│   │   └── scripts/            # 剧本 API
│   │       ├── route.ts        # POST 创建剧本
│   │       └── [id]/
│   │           ├── route.ts    # GET/PUT/DELETE 单个剧本
│   │           ├── export-yaml/
│   │           │   └── route.ts # GET 导出 YAML
│   │           └── import-yaml/
│   │               └── route.ts # POST 导入 YAML
│   ├── components/
│   │   └── NovelList.tsx       # 小说列表 UI 组件
│   ├── page.tsx                # 主页面
│   ├── layout.tsx              # 根布局
│   └── globals.css             # 全局样式
├── lib/
│   ├── db.ts                   # SQLite 数据库初始化
│   ├── types.ts                # TypeScript 类型定义
│   ├── novel-service.ts        # 小说业务逻辑
│   └── script-service.ts       # 剧本业务逻辑
├── scripts/
│   └── seed.ts                 # 示例数据填充脚本
├── data/                       # 运行时数据目录
│   ├── novels.db               # SQLite 数据库
│   └── storage/                # 文件存储
│       └── {novelId}/
│           ├── sources/        # 源文件
│           └── scripts/        # 剧本文件
└── docs/
    ├── 2.md                    # 原始设计文档
    ├── api-docs.md             # API 文档
    └── system-overview.md      # 本文档
```

## 数据模型

### 小说 (novels)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 标题 |
| author | TEXT | 作者 |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |
| status | TEXT | uploading/analyzing/ready/error |
| source_files | TEXT (JSON) | 源文件列表 |
| normalized_path | TEXT | 归一化数据路径 |

### 剧本 (scripts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| novel_id | TEXT FK | 关联小说 ID |
| version | TEXT | 版本号 |
| format | TEXT | 格式 (json) |
| file_path | TEXT | JSON 文件路径 |
| yaml_path | TEXT | YAML 文件路径 |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |
| generation_config | TEXT (JSON) | 生成配置 |

## 核心功能

### 1. 小说管理
- ✅ 创建/删除小说
- ✅ 上传源文件 (支持多文件)
- ✅ 状态管理 (上传中/分析中/就绪/错误)
- ✅ 一对多关系 (一部小说 → 多个剧本)

### 2. 剧本管理
- ✅ 创建/删除剧本
- ✅ 版本管理
- ✅ JSON 格式存储 (结构化数据)
- ✅ YAML 导出 (人类可读格式)
- ✅ YAML 导入 (支持人工编辑后重新导入)

### 3. 文件存储
- ✅ 源文件保存在 `storage/{novelId}/sources/`
- ✅ 剧本文件保存在 `storage/{novelId}/scripts/`
- ✅ 自动创建目录结构
- ✅ 删除时自动清理文件

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.2.7 |
| 语言 | TypeScript | 5.x |
| UI | Tailwind CSS | 4.x |
| 数据库 | better-sqlite3 | 12.x |
| YAML | yaml | 2.x |
| UUID | uuid | 14.x |

## 快速开始

### 安装依赖

```bash
cd ai4n2s
npm install
```

### 填充示例数据

```bash
npm run seed
```

### 启动开发服务器

```bash
npm run dev
```

### 访问系统

打开浏览器访问: http://localhost:3000

## 设计原则

1. **小说作为创作源**: 一部小说可衍生多个剧本
2. **源文件独立存储**: 保留所有原始文件便于追溯
3. **结构化中间表示**: JSON 格式便于 AI 处理
4. **人类可读导出**: YAML 格式便于人工编辑
5. **版本管理**: 支持多版本剧本迭代

## 扩展建议

1. **添加用户认证**: 支持多用户管理
2. **集成 AI 分析**: 调用 LLM 生成 normalized.json
3. **RAG 支持**: 向量检索相关段落
4. **导出格式扩展**: 支持 Fountain、PDF 等格式
5. **协作功能**: 支持多人同时编辑剧本
