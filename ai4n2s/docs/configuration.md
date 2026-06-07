# AI4N2S 配置指南

## 目录

1. [LLM 配置](#llm-配置)
2. [向量数据库配置](#向量数据库配置)
3. [OCR 配置](#ocr-配置)
4. [文件处理器扩展](#文件处理器扩展)
5. [环境变量参考](#环境变量参考)

---

## LLM 配置

### 架构

LLM 模块采用工厂模式，全局单例。所有策略通过 `LLMFactory` 调用 LLM，不直接依赖具体实现。

```typescript
// 接口定义: lib/modules/llm.ts
interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  complete(prompt: string, options?: ChatOptions): Promise<ChatResult>;
}
```

### 配置方式

在应用初始化时（推荐 `lib/modules/llm.ts` 末尾或单独的初始化文件），调用 `LLMFactory.setProvider()`：

```typescript
import { OpenAICompatibleProvider, LLMFactory } from '@/lib/modules/llm';

LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://api.openai.com/v1',   // API 地址
  apiKey: process.env.OPENAI_API_KEY!,     // API 密钥
  defaultModel: 'gpt-4o',                  // 默认模型
}));
```

### 支持的提供商

#### OpenAI

```typescript
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY!,
  defaultModel: 'gpt-4o',         // 或 gpt-4o-mini（成本更低）
}));
```

#### Anthropic (Claude)

Anthropic 的 API 与 OpenAI 不直接兼容，需要实现自定义 Provider：

```typescript
import { LLMProvider, ChatMessage, ChatOptions, ChatResult, LLMFactory } from '@/lib/modules/llm';

class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly description = 'Anthropic Claude API 提供器';

  private apiKey: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; defaultModel?: string }) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'claude-sonnet-4-6';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    // 分离 system 消息
    const systemMsg = messages.find(m => m.role === 'system');
    const otherMsgs = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        system: systemMsg?.content,
        messages: otherMsgs.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API 调用失败 (${response.status})`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

// 注册
LLMFactory.setProvider(new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultModel: 'claude-sonnet-4-6',
}));
```

#### 本地模型 (Ollama / vLLM / LocalAI)

```typescript
// Ollama 默认监听 localhost:11434，兼容 OpenAI API 格式
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',                       // Ollama 不需要真实 key
  defaultModel: 'qwen2.5:32b',            // 推荐中文小说处理
}));

// vLLM 或其他兼容服务
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'http://localhost:8000/v1',
  apiKey: 'not-needed',
  defaultModel: 'Qwen/Qwen2.5-32B-Instruct',
}));
```

#### 云端国产模型

```typescript
// 通义千问 (DashScope)
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.DASHSCOPE_API_KEY!,
  defaultModel: 'qwen-plus',
}));

// DeepSeek
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY!,
  defaultModel: 'deepseek-chat',
}));

// 智谱 GLM
LLMFactory.setProvider(new OpenAICompatibleProvider({
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: process.env.ZHIPU_API_KEY!,
  defaultModel: 'glm-4-plus',
}));
```

### 成本对比 (处理 10 万字小说估算)

| 模型 | 输入单价 | 输出单价 | 估算成本 | 推荐场景 |
|------|---------|---------|---------|---------|
| gpt-4o | $2.50/1M | $10/1M | ~$3-5 | 高质量剧本生成 |
| gpt-4o-mini | $0.15/1M | $0.60/1M | ~$0.2 | 章节摘要/角色提取 |
| claude-sonnet-4-6 | $3/1M | $15/1M | ~$4-6 | 文学性文本处理 |
| deepseek-chat | ¥1/1M | ¥2/1M | ~¥0.5 | 高性价比 |
| qwen-plus | ¥0.8/1M | ¥2/1M | ~¥0.3 | 中文优化 |
| 本地 Ollama | 免费 | 免费 | 免费 | 开发测试 / 隐私敏感 |

### 推荐策略

- **开发阶段**: 使用 Mock 或本地 Ollama（免费、无网络依赖）
- **章节摘要**: 使用 gpt-4o-mini 或 deepseek-chat（低成本）
- **角色提取**: 使用 qwen-plus（中文优化）
- **剧本生成**: 使用 gpt-4o 或 claude-sonnet-4-6（高质量）
- **生产环境**: 混合使用 — 摘要用便宜模型，生成用高端模型

---

## 向量数据库配置

### 架构

RAG 模块采用工厂模式，与 LLM 模块设计一致。

```typescript
// 接口定义: lib/modules/rag.ts
interface RAGProvider {
  name: string;
  indexDocument(sourceId: string, content: string, options?: RAGIndexOptions): Promise<number>;
  query(query: string, options?: RAGQueryOptions): Promise<RAGQueryResult>;
  removeSource(sourceId: string): Promise<void>;
  stats(): { totalChunks: number; totalSources: number };
}
```

### 方案一: 本地 Chroma

```bash
npm install chromadb chromadb-default-embed
```

```typescript
import { ChromaClient } from 'chromadb';
import { RAGProvider, DocumentChunk, RAGQueryOptions, RAGQueryResult, RAGIndexOptions, RAGFactory } from '@/lib/modules/rag';

class ChromaRAGProvider implements RAGProvider {
  readonly name = 'chroma';
  readonly description = 'Chroma 向量数据库 — 本地运行，支持嵌入式部署';

  private client: ChromaClient;
  private collectionName = 'novels';

  constructor(config?: { collectionName?: string }) {
    this.client = new ChromaClient({ path: 'data/chroma' });
    if (config?.collectionName) this.collectionName = config.collectionName;
  }

  async indexDocument(sourceId: string, content: string, options?: RAGIndexOptions): Promise<number> {
    const chunkSize = options?.chunkSize || 2000;
    const overlap = options?.overlap || 200;
    const chunks: string[] = [];
    const metadatas: Array<{ sourceId: string; position: number }> = [];
    const ids: string[] = [];

    let pos = 0;
    let idx = 0;
    while (pos < content.length) {
      const end = Math.min(pos + chunkSize, content.length);
      const chunk = content.slice(pos, end);
      chunks.push(chunk);
      metadatas.push({ sourceId, position: pos });
      ids.push(`${sourceId}-chunk-${idx++}`);
      pos += chunkSize - overlap;
      if (pos >= content.length) break;
    }

    const collection = await this.getOrCreateCollection();
    await collection.add({ ids, documents: chunks, metadatas });
    return chunks.length;
  }

  async query(query: string, options?: RAGQueryOptions): Promise<RAGQueryResult> {
    const collection = await this.getOrCreateCollection();
    const results = await collection.query({
      queryTexts: [query],
      nResults: options?.topK || 5,
    });

    const chunks: DocumentChunk[] = [];
    const scores: number[] = [];

    if (results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const meta = results.metadatas[0]?.[i] as { sourceId: string; position: number } | undefined;
        chunks.push({
          id: results.ids[0][i],
          content: results.documents[0]?.[i] || '',
          metadata: { sourceId: meta?.sourceId || '', position: meta?.position || 0 },
        });
        scores.push((results.distances?.[0]?.[i] || 0));
      }
    }

    return {
      chunks,
      context: chunks.map(c => c.content).join('\n\n---\n\n'),
      scores,
    };
  }

  async removeSource(sourceId: string): Promise<void> {
    const collection = await this.getOrCreateCollection();
    const results = await collection.get({ where: { sourceId } });
    if (results.ids.length > 0) {
      await collection.delete({ ids: results.ids });
    }
  }

  stats(): { totalChunks: number; totalSources: number } {
    // Chroma 的 count 是异步的，这里返回占位
    return { totalChunks: 0, totalSources: 0 };
  }

  private async getOrCreateCollection() {
    try {
      return await this.client.getCollection({ name: this.collectionName });
    } catch {
      return await this.client.createCollection({ name: this.collectionName });
    }
  }
}

// 注册
RAGFactory.setProvider(new ChromaRAGProvider({ collectionName: 'novels' }));
```

### 方案二: Pinecone (云服务)

```bash
npm install @pinecone-database/pinecone
```

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
// 需要配合 embedding 模型使用 (OpenAI Embeddings 或本地模型)
// Pinecone 存储向量，文本存储在本地或对象存储
```

### 方案三: PostgreSQL + pgvector

适合已有 PostgreSQL 的部署环境，零额外运维。

```sql
CREATE EXTENSION vector;
CREATE TABLE novel_chunks (
  id SERIAL PRIMARY KEY,
  source_id TEXT NOT NULL,
  chunk_index INTEGER,
  content TEXT,
  embedding vector(1536)  -- OpenAI text-embedding-3-small 维度
);
CREATE INDEX ON novel_chunks USING ivfflat (embedding vector_cosine_ops);
```

### 方案四: 内存 (开发默认)

当前默认的 `InMemoryRAGProvider` 适合开发和原型验证，无需任何外部依赖。关键词匹配而非语义搜索，但足够验证流程。

### 推荐方案

| 阶段 | 方案 | 理由 |
|------|------|------|
| 开发 | InMemoryRAGProvider | 零配置，快速验证 |
| 测试 | Chroma (本地) | 语义搜索，本地运行 |
| 生产 | Pinecone / pgvector | 云原生，高可用 |

---

## OCR 配置

### Tesseract.js (本地)

```bash
npm install tesseract.js
```

```typescript
import { OCRProvider, OCRResult, OCROptions, OCRFactory } from '@/lib/modules/ocr';
import Tesseract from 'tesseract.js';

class TesseractOCR implements OCRProvider {
  readonly name = 'tesseract';
  readonly description = 'Tesseract.js 本地 OCR';

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult> {
    const { data } = await Tesseract.recognize(imageBuffer, options?.language || 'chi_sim');
    return {
      text: data.text,
      confidence: data.confidence / 100,
      language: options?.language || 'chi_sim',
      duration: 0,
    };
  }

  async recognizeFromFile(filePath: string, options?: OCROptions): Promise<OCRResult> {
    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    return this.recognize(buffer, options);
  }
}

OCRFactory.setProvider(new TesseractOCR());
```

### 云服务 (百度 OCR / 阿里云 OCR)

云端 OCR 识别率更高，但需要网络和付费。

---

## 文件处理器扩展

### 启用 PDF 提取

```bash
npm install pdf-parse
```

修改 `lib/modules/file-processor.ts` 中 `PDFExtractor.extractFromBuffer`:

```typescript
async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
  const pdfParse = await import('pdf-parse');
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    format: 'pdf',
    size: buffer.length,
    estimatedChars: data.text.replace(/\s/g, '').length,
    metadata: { fileName, pages: data.numpages },
  };
}
```

### 启用 DOCX 提取

```bash
npm install mammoth
```

```typescript
async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    format: 'docx',
    size: buffer.length,
    estimatedChars: result.value.replace(/\s/g, '').length,
    metadata: { fileName, warnings: result.messages },
  };
}
```

---

## 环境变量参考

创建 `.env.local` 文件：

```bash
# LLM 配置
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://api.openai.com/v1    # 可选，默认此值
OPENAI_MODEL=gpt-4o                           # 可选

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# 国产模型
DASHSCOPE_API_KEY=sk-xxxxx                    # 通义千问
DEEPSEEK_API_KEY=sk-xxxxx                     # DeepSeek
ZHIPU_API_KEY=xxxxx.xxxxx                     # 智谱 GLM

# 向量数据库 (按需)
PINECONE_API_KEY=xxxxx
PINECONE_ENVIRONMENT=us-east-1

# OCR (按需)
BAIDU_OCR_APP_ID=xxxxx
BAIDU_OCR_API_KEY=xxxxx
BAIDU_OCR_SECRET_KEY=xxxxx
```

---

## 配置验证

配置完成后，通过 API 验证：

```bash
# 1. 上传一个 txt 文件
curl -X POST http://localhost:3000/api/novels/{novelId}/files -F "file=@test.txt"

# 2. 用 AI 策略结构化
curl -X POST http://localhost:3000/api/pipeline/novels/{novelId}/structure \
  -H "Content-Type: application/json" \
  -d '{"strategy":"ai-workflow"}'

# 3. 检查结果 — 角色和摘要应为真实 AI 生成内容
curl http://localhost:3000/api/novels/{novelId}/normalized

# 4. AI+RAG 剧本生成
curl -X POST http://localhost:3000/api/pipeline/scripts/{novelId}/generate \
  -H "Content-Type: application/json" \
  -d '{"strategy":"ai-rag","version":"v1.0"}'
```

如果返回的 `plot_summary` 不是以 "请配置 LLM" 开头，说明 LLM 已正确配置。
