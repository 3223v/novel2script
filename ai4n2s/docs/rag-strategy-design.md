# RAG 增强剧本生成策略设计

> 本文档描述未来引入向量检索（RAG）后，如何升级剧本生成管线以处理长篇小说和复杂上下文。

## 背景

当前 `llm-direct` 策略将所有信息直接塞入 LLM prompt，受限于：

1. **上下文窗口**：章节内容截断到 6000 字，丢失后半部分信息
2. **角色信息扁平化**：全部角色拼进 prompt，角色越多，单个角色的细节越少
3. **无跨章节检索**：生成第 N 章时无法主动引用第 N-3 章的相关内容
4. **信息密度低**：prompt 中大量 token 花费在无关信息上

引入 RAG（Retrieval-Augmented Generation）后，LLM 可以**按需检索**最相关的上下文片段，突破上述限制。

## 目标架构

```
NormalizedNovel（结构化小说）
        │
        ├──→ 建立多维度 RAG 索引
        │     ├── 章节索引: chapter-{i} → 章节全文
        │     ├── 角色索引: char-{name} → 角色出场段落
        │     ├── 地点索引: loc-{name} → 地点描写段落
        │     ├── 情节索引: plot → 全书摘要 + 关键情节点
        │     └── 对话索引: dialogue-{name} → 角色所有台词
        │
        ▼
┌──────────────────────────────────────────────────┐
│              RAG Script Generation               │
│                                                  │
│  每章处理:                                       │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │ 1. 多路检索（Multi-Query Retrieval）   │       │
│  │    ├── 按章节标题检索 → top 3 相关段落  │       │
│  │    ├── 按角色列表检索 → 角色档案 + 台词  │       │
│  │    ├── 按地点检索 → 环境描写            │       │
│  │    └── 按情节检索 → 前后章摘要          │       │
│  │                                        │       │
│  │ 2. 上下文融合（Context Fusion）         │       │
│  │    └── 去重 + 排序 + 拼接              │       │
│  │                                        │       │
│  │ 3. LLM 生成（两阶段，同 llm-direct）     │       │
│  │    ├── 草稿: T=0.7 + RAG 上下文        │       │
│  │    └── 审查: T=0.3 + RAG 上下文        │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 索引构建

### 分块策略

不同于当前 `InMemoryRAGProvider` 的简单固定长度分块，RAG 策略需要**语义感知的分块**：

```typescript
interface ChunkStrategy {
  /** 按章节自然边界分块 */
  chapter: (novel: NormalizedNovel) => DocumentChunk[];
  /** 按角色出场分块 — 提取每个角色出现的所有段落 */
  character: (novel: NormalizedNovel) => DocumentChunk[];
  /** 按地点分块 — 提取每个地点被描写的段落 */
  location: (novel: NormalizedNovel) => DocumentChunk[];
  /** 按对话分块 — 提取每个角色的所有台词 */
  dialogue: (novel: NormalizedNovel) => DocumentChunk[];
}
```

分块参数：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `chunkSize` | 2000 字符 | 足够包含一个完整场景段落 |
| `overlap` | 300 字符 | 保证段落边界不被切断 |
| `minChunkSize` | 100 字符 | 过滤过短的碎片 |

### 多维索引结构

```
rag_index/
├── {novelId}-chapters/      # 章节全文索引（粗粒度）
│   ├── chunk-0 → "第一章全文..."
│   └── chunk-1 → "第二章全文..."
│
├── {novelId}-characters/    # 角色出场索引（细粒度）
│   ├── 罗辑-chunk-0 → "罗辑站在墓前，风吹过他的大衣..."
│   ├── 罗辑-chunk-1 → "罗辑点燃一支烟，缓缓说道..."
│   └── 大史-chunk-0 → "大史从车里探出头来..."
│
├── {novelId}-dialogues/     # 对话索引
│   ├── 罗辑-台词-0 → "'你真是个神秘的女人。'"
│   └── 大史-台词-0 → "'走吧，罗教授。这里风大。'"
│
├── {novelId}-locations/     # 地点描写索引
│   ├── 墓地-chunk-0 → "荒凉的墓地，只有一块简单的石碑..."
│   └── 办公室-chunk-0 → "昏暗的办公室里堆满了文件..."
│
└── {novelId}-plot/          # 情节索引
    └── summary → "本书通过现代研究者王二的荒诞视角..."
```

## 检索策略

### 多路检索（Multi-Query Retrieval）

每章生成时执行 4 路并行检索：

```typescript
async function retrieveContext(
  chapter: NovelChapter,
  novelId: string,
  allCharacters: Character[],
): Promise<RetrievedContext> {
  const [chapterChunks, characterChunks, locationChunks, dialogueChunks, plotChunks] =
    await Promise.all([
      // 路 1: 按章节标题 + 内容关键词检索相关段落
      RAGFactory.query(chapter.title + ' ' + chapter.content.slice(0, 500), {
        sourceId: `${novelId}-chapters`,
        topK: 3,
      }),

      // 路 2: 按本章出场角色检索他们的档案和出场段落
      RAGFactory.query(chapter.characters.join(' '), {
        sourceId: `${novelId}-characters`,
        topK: 5,
      }),

      // 路 3: 按本章地点检索环境描写
      RAGFactory.query(chapter.locations.join(' '), {
        sourceId: `${novelId}-locations`,
        topK: 3,
      }),

      // 路 4: 检索本章角色的历史台词（保持语气一致）
      ...chapter.characters.map((name) =>
        RAGFactory.query(name, {
          sourceId: `${novelId}-dialogues`,
          topK: 2,
        })
      ),
    ]);

  return fuseAndDeduplicate([...chapterChunks, ...characterChunks, ...locationChunks, ...dialogueChunks.flat()]);
}
```

### 上下文融合（Context Fusion）

多路检索的结果需要去重、排序、拼接：

```typescript
function fuseAndDeduplicate(
  results: RAGQueryResult[],
  maxTokens: number = 4000,
): string {
  const seen = new Set<string>();
  const allChunks: Array<{ content: string; score: number; source: string }> = [];

  for (const result of results) {
    for (let i = 0; i < result.chunks.length; i++) {
      const fingerprint = hashContent(result.chunks[i].content);
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        allChunks.push({
          content: result.chunks[i].content,
          score: result.scores[i],
          source: result.chunks[i].metadata.sourceId,
        });
      }
    }
  }

  // 按相关性排序
  allChunks.sort((a, b) => b.score - a.score);

  // 拼接并截断到 token 上限
  return truncateToTokens(
    allChunks.map((c) => `[${c.source}]\n${c.content}`).join('\n\n---\n\n'),
    maxTokens,
  );
}
```

### 查询优化：HyDE（ Hypothetical Document Embedding）

对于模糊查询（如"上一章发生了什么"），先生成一个假设文档再检索：

```typescript
async function hydeRetrieve(
  question: string,
  sourceId: string,
): Promise<RAGQueryResult> {
  // 1. LLM 生成假设答案
  const hypothesis = await LLMFactory.complete(
    `请用一段话回答: ${question}`,
    { temperature: 0, maxTokens: 200 },
  );

  // 2. 用假设答案作为查询向量
  return RAGFactory.query(hypothesis.content, { sourceId, topK: 5 });
}
```

HyDE 的适用场景：
- "检索前面的关键剧情" — 生成假设性的剧情摘要，用摘要去检索
- "这个角色的性格特点" — 生成假设性的角色描述，用描述去检索

## Prompt 设计升级

### RAG 增强的草稿 Prompt

```
[SYSTEM] 你是一位资深编剧...（同 llm-direct）

[USER]
请将以下小说章节转化为剧本:

【章节标题】{title}
【章节内容】{content.slice(0, 4000)}  ← 减少到 4000 字

【RAG 检索 — 相关上下文】
{retrievedContext}                      ← 替代原来的截断内容

【角色档案】                             ← 从 RAG 检索中增强
{characterProfile}                      ← 包含台词示例

【当前章节角色历史台词】
罗辑（前 3 次出场）：
  "'你真是个神秘的女人。'"（第一章）
  "'我从不相信命运。'"（第二章）
  "'这是一场豪赌。'"（第四章）

【全书摘要】
{plotSummary}
```

关键变化：

1. **章节内容减少到 4000 字**：RAG 检索补充了更多上下文，不再需要原文全貌
2. **角色历史台词**：从对话索引中检索该角色之前说过的台词，帮助 LLM 保持语气一致
3. **相关上下文**：来自多路检索的综合结果

### Prompt Token 预算分配

| 组成部分 | llm-direct | RAG 增强 | 说明 |
|---------|-----------|---------|------|
| System Prompt | ~500 tokens | ~500 tokens | 不变 |
| 章节内容 | ~3000 tokens | ~2000 tokens | ↓ RAG 补充了上下文 |
| 角色档案 | ~500 tokens | ~500 tokens | 不变 |
| 全书摘要 | ~200 tokens | ~200 tokens | 不变 |
| RAG 检索上下文 | 0 | ~2500 tokens | ↑ 新增 |
| 角色历史台词 | 0 | ~500 tokens | ↑ 新增 |
| 指令+格式 | ~300 tokens | ~300 tokens | 不变 |
| **总计** | **~4500 tokens** | **~6500 tokens** | 仍在常见模型窗口内 |

## 向量数据库选型

### 方案对比

| 方案 | 优势 | 劣势 | 推荐场景 |
|------|------|------|---------|
| **Chroma** (本地) | 零配置、嵌入式、免费 | 单机性能限制 | 开发和小规模部署 |
| **Milvus Lite** | 高性能、本地运行 | 需要额外依赖 | 单机生产环境 |
| **Pinecone** | 全托管、自动扩容 | 付费、数据出境 | 商业 SaaS 产品 |
| **pgvector** | 与现有 PG 复用 | 需要 PostgreSQL | 已有 PG 的项目 |
| **SQLite + 扩展** | 与现有 DB 统一 | 社区方案成熟度低 | 全栈 SQLite 部署 |

### 推荐演进路径

```
开发阶段        测试阶段           生产阶段
    │               │                  │
InMemoryRAG  →  Chroma 本地  →  pgvector / Pinecone
(关键词匹配)    (向量检索)        (高可用部署)
```

## 性能优化

### 索引构建时机

| 时机 | 触发条件 | 策略 |
|------|---------|------|
| 小说结构化完成时 | `normalized.json` 保存后 | 增量构建所有索引 |
| 小说内容更新时 | `normalized.json` 修改 | 删除旧索引 → 重建 |
| 首次生成请求时 | 索引不存在 | 懒加载构建 |

### 检索缓存

```typescript
const retrievalCache = new Map<string, { result: RAGQueryResult; timestamp: number }>();

async function cachedRetrieve(query: string, options: RAGQueryOptions): Promise<RAGQueryResult> {
  const key = `${query}|${JSON.stringify(options)}`;
  const cached = retrievalCache.get(key);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.result; // 5 分钟缓存
  }
  const result = await RAGFactory.query(query, options);
  retrievalCache.set(key, { result, timestamp: Date.now() });
  return result;
}
```

同一章节的草稿和审查阶段使用相同的检索查询，缓存可节省 50% 的检索调用。

## 与 llm-direct 的切换策略

```typescript
function selectStrategy(novel: NormalizedNovel): 'llm-direct' | 'rag' {
  const avgChapterLen = average(novel.chapters.map((c) => c.content.length));
  const totalChars = novel.chapters.length * avgChapterLen;

  if (totalChars < 50000) return 'llm-direct';   // 短篇小说：直接传全文
  if (avgChapterLen < 4000) return 'llm-direct';  // 章节短：不需要检索
  return 'rag';                                    // 长篇小说：启用 RAG
}
```

规则：
- 总字数 < 5 万 → `llm-direct` 已足够
- 平均每章 < 4000 字 → 无需检索增强
- 其他情况 → 自动选择 RAG

此逻辑可实现为**策略选择器中间件**，对用户透明。

## 实现路线图

### Phase 1: 向量化 RAG Provider

- [ ] 实现 `ChromaRAGProvider` 或 `MilvusLiteProvider`
- [ ] 注册到 `RAGFactory`
- [ ] 验证基础检索功能

### Phase 2: 多维索引

- [ ] 实现语义分块（章节/角色/地点/对话）
- [ ] 实现索引构建管线
- [ ] 实现增量更新

### Phase 3: 多路检索

- [ ] 实现 4 路并行检索
- [ ] 实现上下文融合（去重+排序+拼接）
- [ ] 实现检索缓存

### Phase 4: RAG 策略升级

- [ ] 重构 `ai-rag-strategy.ts` 使用多维索引
- [ ] 实现角色历史台词检索
- [ ] 实现 HyDE 查询优化
- [ ] 实现自动策略选择器

### Phase 5: 质量评估

- [ ] 对比 `llm-direct` vs `rag` 生成质量
- [ ] 评估检索相关性
- [ ] 调优分块参数和检索策略
