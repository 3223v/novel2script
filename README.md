# AI4N2S — 小说转剧本系统

基于 Next.js 16 + SQLite + YAML 构建的 AI 辅助小说转剧本数据管理系统。

## 功能

- **小说管理** — 创建/删除小说，上传源文件（PDF、DOCX、TXT）
- **结构化分析** — 将小说文本分析为结构化 JSON（章节、角色、地点、场景）
- **剧本生成** — 从结构化小说数据生成标准剧本格式（场景、对话、转场）
- **剧本编辑** — 可视化编辑场景、角色、对话，支持手动与 AI 辅助
- **YAML 导出** — 剧本支持导出为 YAML 格式，便于人工编辑和版本管理

## 快速开始

```bash
cd ai4n2s
npm install
npm run seed    # 填充示例数据
npm run dev     # 启动开发服务器
```

打开 http://localhost:3000

## 项目文档

- [架构总览](docs/architecture.md) — 架构、目录、技术栈
- [API 参考](docs/api.md) — 全部 API 端点
- [数据模型](docs/data-model.md) — 数据库、JSON 结构、存储
- [策略指南](docs/strategies.md) — 算法实现详解
- [配置指南](docs/configuration.md) — LLM / 向量数据库 / OCR 配置
- [EPUB 参考](docs/epub-strategy.md) — EPUB 解析参考实现

## 设计风格

白色背景 + 黑色线框的复古蓝图风格。锐利边缘、纯黑边框、monospace 字体。

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · SQLite · YAML
