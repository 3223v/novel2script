# 剧本 YAML Schema 设计文档

> 本文档说明 AI4N2S 中 `ScriptYAML` 的数据结构定义及其设计原因。

## 概述

`ScriptYAML` 是 AI4N2S 系统的核心输出格式，用于表示从小说转化而来的标准剧本。它被序列化为 JSON 存储，同时支持 YAML 导出以便人工编辑和版本管理。

## 完整 Schema

```typescript
interface ScriptYAML {
  script: {
    metadata: ScriptMetadata;
    characters?: ScriptCharacter[];
    scenes: ScriptScene[];
  };
}
```

### ScriptMetadata — 剧本元数据

```typescript
interface ScriptMetadata {
  title: string;       // 剧本标题
  author: string;      // 编剧（含 AI 标识）
  based_on: string;    // 原著名称
  version: string;     // 语义版本号，如 "v1.0" / "draft-0.1"
  date: string;        // ISO 日期，如 "2026-06-08"
  logline?: string;    // 一句话梗概（可选）
  genre?: string[];    // 类型标签，如 ["科幻", "剧情"]（可选）
}
```

### ScriptCharacter — 剧本角色

```typescript
interface ScriptCharacter {
  id: string;          // 唯一标识，与 NormalizedNovel 中的角色 ID 对应
  name: string;        // 角色名
  description?: string; // 角色简介（可选）
}
```

### ScriptScene — 场景

```typescript
interface ScriptScene {
  id: string;          // 场景唯一标识
  heading: string;     // 场景标题，如 "内. 办公室 - 日"
  content: SceneContent[]; // 场景内容序列
  notes?: string;      // 备注（可选）
  tags?: string[];     // 标签，如 ["情感", "高潮"]（可选）
}
```

### SceneContent — 场景内容项（判别联合）

```typescript
type SceneContent =
  | { type: 'action';      text: string }                          // 动作/环境描述
  | { type: 'character';   name: string; parenthetical?: string; dialogue: string }  // 角色对话
  | { type: 'transition';  text: string }                          // 转场提示
  | { type: 'shot';        text: string };                         // 镜头指示
```

## 设计原因

### 1. 为什么用 `script` 作为顶层键？

```yaml
script:
  metadata: ...
  characters: ...
  scenes: ...
```

**原因**：为将来扩展预留空间。一个 YAML 文件可能包含多个部分（如 `script` + `notes` + `revisions`），顶层键充当命名空间。参考了 [Fountain](https://fountain.io) 和 [Final Draft](https://www.finaldraft.com) 的结构化输出惯例。

### 2. 为什么 SceneContent 使用判别联合（Discriminated Union）？

```typescript
type SceneContent =
  | { type: 'action';      text: string }
  | { type: 'character';   name: string; parenthetical?: string; dialogue: string }
  | { type: 'transition';  text: string }
  | { type: 'shot';        text: string };
```

**原因**：

- **类型安全**：TypeScript 编译器可以根据 `type` 字段自动推断可用属性。访问 `item.name` 时，编译器知道 `item` 一定是 `character` 类型。
- **行业标准对齐**：这四种类型覆盖了好莱坞标准剧本格式的核心元素：
  - `action` — 动作描述，相当于剧本中的叙事段落
  - `character` — 角色对白，含姓名、可选的情绪括号、台词
  - `transition` — 转场提示（CUT TO、FADE IN 等）
  - `shot` — 镜头指示，用于分镜脚本
- **可扩展**：新增类型只需扩展 union，不影响已有代码。
- **渲染友好**：每种类型对应不同的 UI 渲染和导出格式。

### 3. 为什么角色对白拆分为 name / parenthetical / dialogue？

```
           name        parenthetical    dialogue
            │              │               │
            ▼              ▼               ▼
    { type: 'character', name: '张三', parenthetical: '(低声)', dialogue: '你怎么能这样！' }
```

**原因**：和剧本行业惯例对齐：

| 字段 | 对应剧本格式 | 示例 |
|------|-------------|------|
| `name` | 角色名（大写居中） | 张三 |
| `parenthetical` | 括号内的情绪/动作提示 | (低声) |
| `dialogue` | 台词正文 | 你怎么能这样！ |

分开存储而非合并为单一字符串，便于：
- UI 中分段编辑（角色名下拉选择、台词自由输入）
- 导出时自动格式化（角色名大写、台词缩进）
- 角色台词统计分析（某个角色说了多少话）
- AI 辅助时的结构化校验（角色名是否在角色列表中）

### 4. 为什么 scenes 是数组而非按幕/章节组织？

```yaml
scenes:
  - id: "sc_1"
    heading: "内. 办公室 - 日"
    content: [...]
  - id: "sc_2"
    heading: "外. 街道 - 夜"
    content: [...]
```

**原因**：

- **线性时间线**：剧本本质上是场景的线性序列，嵌套结构（幕→序列→场景）在不同项目间差异巨大，不适合硬编码。
- **灵活性**：通过 `tags` 字段可以标记场景归属（如 `tags: ["第一幕"]`），而不强制层级。
- **编辑友好**：场景平铺排列便于拖拽排序、插入和删除。
- **与行业工具兼容**：大多数剧本软件的导入导出格式都是平铺场景列表。

### 5. 为什么 metadata 和 scenes 之间夹着 characters 数组？

```yaml
script:
  metadata: {...}
  characters:        # ← 在元数据和场景之间
    - id: "luo_ji"
      name: "罗辑"
      description: "社会学博士，面壁者"
  scenes: [...]
```

**原因**：

- **阅读顺序**：先了解基本信息（metadata），再认识人物（characters），最后看具体剧情（scenes）——符合剧本阅读的自然顺序。
- **角色先行**：编剧通常在写场景前先确定角色列表。这个结构反映了"先定角色再写戏"的工作流。
- **场景引用角色 ID**：场景中的 `character` 内容项虽然存储的是 `name` 字符串，但 `ScriptCharacter.id` 可用于从场景追溯角色详情。

### 6. 为什么使用 YAML 作为导出格式？

```
JSON（内部存储）— 机器友好，快速读写
 YAML（对外导出）— 人类友好，便于编辑和版本管理
```

**原因**：

- **可读性**：YAML 的缩进结构天然适合剧本的多层嵌套数据。
- **版本管理**：YAML 是纯文本，diff 友好。修改一行台词在 git 中就是一行的变化。
- **行业惯例**：剧本管理工具（如 Celtx、WriterSolo）普遍支持 YAML 或类 YAML 格式。
- **双向转换**：系统支持 YAML 导入和导出，用户可以用外部编辑器修改后导回。

## YAML 导出示例

```yaml
script:
  metadata:
    title: 三体·黑暗森林（节选）
    author: 刘慈欣（原著） / AI 辅助改编
    based_on: 《三体II：黑暗森林》
    version: draft-0.1
    date: 2026-06-08
    logline: 面对三体人的入侵，人类启动面壁计划。
    genre:
      - 科幻
      - 剧情
  characters:
    - id: luo_ji
      name: 罗辑
      description: 社会学博士，被选为面壁者。
    - id: da_shi
      name: 大史
      description: 资深刑警，罗辑的保镖。
  scenes:
    - id: sc_1
      heading: 外. 杨冬墓前 - 日
      content:
        - type: action
          text: 荒凉的墓地，罗辑独自站在墓前。
        - type: character
          name: 罗辑
          parenthetical: （低声）
          dialogue: 你真是个神秘的女人，杨冬。
        - type: transition
          text: CUT TO:
      notes: 开场氛围铺垫
      tags:
        - 情感
        - 开场
```

## 对比其他格式

| 特性 | ScriptYAML | Fountain | Final Draft XML | 纯文本 |
|------|-----------|----------|----------------|--------|
| 结构化 | ✅ 强类型 | ❌ 标记语法 | ✅ XML Schema | ❌ |
| 可读性 | ✅ 高 | ✅ 很高 | ❌ 冗长 | ✅ |
| 可编辑性 | ✅ YAML 编辑器 | ✅ 任何文本编辑器 | ❌ 需专用软件 | ✅ |
| 版本控制 | ✅ Git 友好 | ✅ Git 友好 | ❌ XML diff 差 | ✅ |
| AI 处理 | ✅ JSON 原生 | ❌ 需解析 | ❌ 需解析 | ❌ |
| 程序化操作 | ✅ 类型安全 | ❌ 字符串解析 | ⚠️ DOM 操作 | ❌ |

## 扩展性

当前 Schema 预留了以下扩展点：

- `ScriptMetadata` 可以增加 `copyright`、`contact`、`revision_history` 等字段
- `ScriptScene` 的 `tags` 可扩展为结构化对象
- `SceneContent` 的判别联合可新增类型（如 `music`、`sfx`、`montage`）
- 顶层 `script` 键的兄弟位置可增加 `storyboard`、`schedule`、`budget` 等模块
