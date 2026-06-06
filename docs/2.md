# 小说转剧本系统 - 数据存储格式与剧本 YAML Schema 设计文档

## 一、数据存储格式（小说 ↔ 剧本 一对多关系）

### 1.1 总体设计原则

- **小说作为创作源**：一部小说可以衍生出多个剧本（如不同版本、不同风格、不同目标受众）。
- **源文件独立存储**：小说可能包含多个源文件（如不同章节的 `.txt`、原始 `.pdf`、修订稿 `.docx`），所有源文件均保留，便于追溯。
- **结构化中间表示**：每部小说会生成一份归一化的结构化 JSON（角色、场景、情节、主题等），供剧本生成使用。
- **剧本独立存储**：每个剧本对应一个完整的 JSON 文件，其中包含剧本元数据、分场列表、角色对白等，便于导出为 YAML 或 Fountain 等人类可编辑格式。

### 1.2 文件系统组织

使用 `data/` 根目录，所有内容存放在该目录下，便于备份和迁移。

```
data/
├── novels.db                     # SQLite 数据库（记录元数据与关系）
├── storage/
│   ├── {novelId}/                # 每部小说一个文件夹
│   │   ├── sources/              # 原始源文件目录
│   │   │   ├── chapter1.txt
│   │   │   ├── chapter2.pdf
│   │   │   └── full.docx
│   │   ├── normalized.json       # 结构化的中间表示（角色、场景、情节等）
│   │   ├── scripts/              # 剧本目录
│   │   │   ├── {scriptId}.json   # 每个剧本一个 JSON 文件
│   │   │   └── {scriptId}.yaml   # 可选导出的 YAML 版本（供人类编辑）
│   │   └── rag/                  # 可选：向量索引文件（云 RAG 时本地缓存）
│   └── ...
```

### 1.3 SQLite 数据模型

**表 `novels`**（小说主表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID |
| title | TEXT | 小说标题 |
| author | TEXT | 作者 |
| created_at | INTEGER | Unix 时间戳 |
| updated_at | INTEGER | 更新时间 |
| status | TEXT | uploading / analyzing / ready / error |
| source_files | TEXT (JSON) | 源文件列表，如 `[{"name":"ch1.txt","path":"sources/ch1.txt","type":"text/plain"}]` |
| normalized_path | TEXT | 相对路径指向 `normalized.json` |

**表 `scripts`**（剧本表，一对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID |
| novel_id | TEXT | 外键，关联 `novels.id` |
| version | TEXT | 剧本版本号，如 "v1.0" 或 "导演剪辑版" |
| format | TEXT | 内部格式，固定为 `json` |
| file_path | TEXT | 相对路径指向 `scripts/{id}.json` |
| yaml_path | TEXT | 可选，指向导出的 YAML 文件 |
| created_at | INTEGER | 生成时间 |
| updated_at | INTEGER | 最后修改时间（如手动编辑 YAML 后重新导入） |
| generation_config | TEXT (JSON) | 生成该剧本时使用的参数（如 LLM 温度、RAG 开关等） |

**表 `tasks`**（任务队列，与之前设计一致，此处略）

### 1.4 中间表示 `normalized.json` 结构

该文件是从源文件中提取并分析得到的结构化小说数据，供剧本生成模块使用。格式示例：

```json
{
  "metadata": {
    "title": "三体",
    "author": "刘慈欣",
    "word_count": 280000,
    "analysis_date": 1700000000
  },
  "characters": [
    {
      "id": "char_001",
      "name": "汪淼",
      "aliases": ["淼哥"],
      "description": "纳米材料科学家",
      "personality": "理性、执着",
      "role": "protagonist"
    }
  ],
  "locations": [
    {
      "id": "loc_001",
      "name": "红岸基地",
      "description": "雷达发射基地，位于大兴安岭"
    }
  ],
  "plot_summary": "全文摘要……",
  "chapters": [
    {
      "index": 1,
      "title": "科学边界",
      "summary": "汪淼参与组织，发现诡异现象"
    }
  ],
  "scenes": [
    {
      "chapter_index": 1,
      "heading": "汪淼的房间",
      "raw_text": "整个段落原文...",
      "characters": ["char_001"],
      "locations": ["loc_002"]
    }
  ]
}
```

> **说明**：`normalized.json` 由全局分析模块生成，后续剧本生成可以直接使用其中的 `scenes` 数组，也可以作为 RAG 索引的源文档。

---

## 二、剧本 YAML Schema 设计

### 2.1 设计目标

- **可读可写**：YAML 格式天然适合人工编辑，编剧可以快速修改对白、动作描述。
- **结构完整**：涵盖标准剧本所需的所有元素（场景标题、动作、角色、对白、括号提示）。
- **扩展性**：预留元数据字段，支持自定义标记（如标记需要修改的段落）。
- **互操作性**：可无损转换为 Fountain、PDF 或专业编剧软件（如 Final Draft）的导入格式。

### 2.2 YAML Schema 定义（基于 JSON Schema 思想）

```yaml
# 剧本根对象
script:
  # 元数据（必填）
  metadata:
    title: string          # 剧本标题
    author: string         # 编剧（可包含原著作者）
    based_on: string       # 原著小说名称
    version: string        # 版本号，如 "draft-1"
    date: string           # 创作/修改日期，ISO 8601
    logline: string?       # 一句话故事梗概
    genre: string[]?       # 类型，如 ["科幻", "悬疑"]
    
  # 角色表（可选，但推荐）
  characters:
    - id: string           # 唯一标识，如 "wei_cheng"
      name: string         # 角色名称
      description: string? # 简短介绍
      # 可扩展字段
      
  # 场景列表（必填）
  scenes:
    - id: string           # 场景唯一标识，如 "sc_1"
      # 场景标题（标准格式：内/外. 地点 - 时间）
      heading: string      # 例如 "内. 汪淼的实验室 - 日"
      # 场景内容列表（动作、角色、对白等混合）
      content:
        - type: action
          text: string      # 动作描述，如 "汪淼盯着电脑屏幕，冷汗滴落。"
        - type: character
          name: string      # 正在说话的角色名（必须与 characters 中的 id 或 name 匹配）
          parenthetical: string? # 括号内的指示，如 "（紧张地）"
          dialogue: string   # 对白内容，支持多行
        - type: transition   # 转场，如 "切至："、"淡出"
          text: string
        - type: shot         # 镜头描述（可选）
          text: string
      # 可选扩展字段
      notes: string?        # 编剧备注，不会出现在最终脚本中
      tags: string[]?       # 自定义标签，如 ["高潮", "需要重写"]
```

### 2.3 示例 YAML 剧本

```yaml
script:
  metadata:
    title: 三体·黑暗森林（节选）
    author: 刘慈欣（原著） / AI 辅助改编
    based_on: 《三体II：黑暗森林》
    version: draft-0.1
    date: 2026-06-06
    logline: 面对三体人的入侵，人类启动面壁计划，四位面壁者展开绝望反击。
    genre: ["科幻", "剧情"]
    
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
          text: 荒凉的墓地，只有一块简单的石碑。罗辑独自站在墓前，大史在不远处抽烟。
        - type: character
          name: 罗辑
          parenthetical: （低声）
          dialogue: |
            你真是个神秘的女人，杨冬。
            直到你死后，我才发现我对你一无所知。
        - type: action
          text: 大史踩灭烟头，走过来。
        - type: character
          name: 大史
          dialogue: 走吧，罗教授。这里风大。
        - type: transition
          text: 切至：
      notes: 第一幕氛围铺垫，后续可加入更多关于“黑暗森林”的隐喻。
      tags: ["情感", "开场"]
```

### 2.4 Schema 设计原因详解

#### 2.4.1 为什么使用 YAML 而不是 JSON？

- **人类可编辑性**：编剧习惯直接修改对白、动作，YAML 的缩进语法比 JSON 更清爽，减少括号和引号干扰。
- **支持注释**：YAML 允许 `#` 注释，编剧可以在剧本中直接写下修改意见或备忘，而不破坏结构。
- **多行字符串**：对白通常较长，YAML 的 `|` 或 `>` 语法可以优雅保留换行，而 JSON 需要转义。

#### 2.4.2 场景内容数组的设计考量

将场景内容表示为 **类型-文本对** 数组，而非固定字段（如 `action`、`dialogue` 分开存储），原因如下：

1. **顺序灵活**：剧本中动作、对白、角色指示、转场可以任意交错，数组天然保留顺序。
2. **扩展性强**：未来可轻松添加新类型（如 `sound_effect`、`voice_over`），无需修改 schema。
3. **转换简单**：导出到 Fountain 或 PDF 时，只需按类型映射到对应格式。

#### 2.4.3 角色表与场景引用的解耦

- 角色表使用 `id` 或 `name` 关联，场景中对白只需填写 `name` 即可，不强制要求预定义。  
  **原因**：AI 生成时可能临时出现小角色（如“服务员”），不必预先注册所有角色。
- 对于主要角色，预定义表可以用于校验和生成角色小传。

#### 2.4.4 保留原始段落信息（可选）

在 `scenes` 中增加 `source_ref` 字段（本 schema 未展示，但可扩展），可以记录该场景来源于小说的哪些段落（章节索引、偏移量）。  
**原因**：便于编剧回溯原文，确认改编是否忠实。

#### 2.4.5 元数据的完整性

- `based_on`、`author`、`version`、`date` 等信息确保多版本剧本可管理，尤其当 AI 生成多个不同风格的剧本时。
- `logline` 和 `genre` 有助于快速筛选和定位。

#### 2.4.6 兼容行业标准

- **场景标题格式** `内/外. 地点 - 时间` 是好莱坞剧本的通用格式，可被大多数编剧软件识别。
- **对白写法** 与 Fountain 语法一致，未来可以直接用 `fountain` 库渲染为 PDF。
- `parenthetical` 括号提示是剧本行业标准，用于指示语气或动作。

---

## 三、从结构化小说到剧本 YAML 的转换流程（简述）

1. **源文件上传** → 存储到 `storage/{novelId}/sources/`，更新 `novels.source_files`。
2. **全局分析** → 生成 `normalized.json`，包含角色、地点、场景分割等。
3. **剧本生成**（用户触发）→ 读取 `normalized.json`，可选使用云 RAG 检索相关段落，调用 LLM 逐场景生成符合上述 YAML Schema 的 JSON 对象。
4. **存储剧本** → 将 JSON 写入 `storage/{novelId}/scripts/{scriptId}.json`，同时在 `scripts` 表中记录。
5. **导出 YAML** → 将 JSON 转换为 YAML 字符串，保存为 `.yaml` 文件供用户下载或编辑。
6. **用户编辑后导入**（可选）→ 用户上传修改后的 YAML 文件，系统解析并覆盖原 JSON（需校验 schema）。

---

## 四、总结

本文档设计了满足“一对多小说→剧本”关系的数据存储方案，并给出了一个**可读、可编辑、可扩展**的剧本 YAML Schema。该 Schema 平衡了 AI 生成的便利性与人类编剧的修改习惯，同时兼容行业规范，可平滑对接下游导出工具。

通过将结构化小说与剧本分离，系统不仅能够生成初稿，还能支持作者多版本创作、回溯原文、迭代打磨，真正实现“快速获得可编辑的剧本初稿”的目标。