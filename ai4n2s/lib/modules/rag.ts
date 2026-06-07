/**
 * RAG (检索增强生成) 模块 — 将长文本分块索引，按查询检索相关上下文
 *
 * 采用策略模式:
 *   RAGProvider (接口) ← InMemoryRAG / VectorDBRAG / ...
 *
 * 默认使用 InMemoryRAG，基于简单关键词匹配。
 * 扩展时实现 RAGProvider 接口并注册到 RAGFactory。
 */

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

export interface DocumentChunk {
  /** 唯一标识 */
  id: string;
  /** 文本内容 */
  content: string;
  /** 元数据 */
  metadata: {
    /** 来源文档标识 */
    sourceId: string;
    /** 在原文中的位置 (字符偏移) */
    position: number;
    /** 章节/段落编号 */
    section?: string;
    /** 额外的可搜索标签 */
    tags?: string[];
  };
}

export interface RAGQueryOptions {
  /** 返回的最大 chunk 数 */
  topK?: number;
  /** 最小相关性阈值 (0-1) */
  minScore?: number;
  /** 额外过滤条件 */
  filter?: {
    sourceId?: string;
    section?: string;
    tags?: string[];
  };
}

export interface RAGQueryResult {
  /** 匹配的 chunks */
  chunks: DocumentChunk[];
  /** 拼接后的上下文文本 */
  context: string;
  /** 每个 chunk 的相关性分数 */
  scores: number[];
}

export interface RAGIndexOptions {
  /** 每个 chunk 的最大字符数 */
  chunkSize?: number;
  /** chunk 之间的重叠字符数 */
  overlap?: number;
}

// ══════════════════════════════════════════════════════
// Provider 接口
// ══════════════════════════════════════════════════════

export interface RAGProvider {
  readonly name: string;
  readonly description: string;

  /** 索引一份文档 */
  indexDocument(sourceId: string, content: string, options?: RAGIndexOptions): Promise<number>;

  /** 查询相关内容 */
  query(query: string, options?: RAGQueryOptions): Promise<RAGQueryResult>;

  /** 删除某来源的所有 chunks */
  removeSource(sourceId: string): Promise<void>;

  /** 获取统计信息 */
  stats(): { totalChunks: number; totalSources: number };
}

// ══════════════════════════════════════════════════════
// In-Memory RAG Provider (默认实现)
// ══════════════════════════════════════════════════════

export class InMemoryRAGProvider implements RAGProvider {
  readonly name = 'in-memory';
  readonly description = '内存 RAG 提供器 — 基于关键词匹配，适合原型和小数据量';

  private chunks: DocumentChunk[] = [];
  private idCounter = 0;

  async indexDocument(
    sourceId: string,
    content: string,
    options?: RAGIndexOptions
  ): Promise<number> {
    const chunkSize = options?.chunkSize || 2000;
    const overlap = options?.overlap || 200;

    // 移除旧数据
    this.removeSource(sourceId);

    let position = 0;
    let added = 0;

    while (position < content.length) {
      const end = Math.min(position + chunkSize, content.length);
      const chunkContent = content.slice(position, end);

      this.chunks.push({
        id: `chunk-${++this.idCounter}`,
        content: chunkContent,
        metadata: {
          sourceId,
          position,
          section: this.detectSection(chunkContent),
          tags: this.extractTags(chunkContent),
        },
      });

      added++;
      position += chunkSize - overlap;
      if (position >= content.length) break;
    }

    return added;
  }

  async query(query: string, options?: RAGQueryOptions): Promise<RAGQueryResult> {
    const topK = options?.topK || 5;
    const minScore = options?.minScore || 0;
    const filter = options?.filter;

    // 过滤
    let candidates = this.chunks;
    if (filter?.sourceId) {
      candidates = candidates.filter(c => c.metadata.sourceId === filter.sourceId);
    }
    if (filter?.section) {
      candidates = candidates.filter(c => c.metadata.section === filter.section);
    }
    if (filter?.tags?.length) {
      candidates = candidates.filter(c =>
        filter.tags!.some(t => c.metadata.tags?.includes(t))
      );
    }

    // 关键词匹配打分
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = candidates.map(chunk => {
      const lowerContent = chunk.content.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        // 精确匹配加分
        const count = lowerContent.split(term).length - 1;
        score += count * 10;
      }
      // 标签匹配加分
      if (chunk.metadata.tags) {
        for (const term of queryTerms) {
          if (chunk.metadata.tags.some(t => t.includes(term))) {
            score += 5;
          }
        }
      }
      // 归一化
      score = score / (chunk.content.length + 1) * 1000;
      return { chunk, score };
    });

    // 过滤低分 & 排序 & 取 topK
    const top = scored
      .filter(s => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const chunks = top.map(t => t.chunk);
    const scores = top.map(t => t.score);
    const context = chunks.map(c => c.content).join('\n\n---\n\n');

    return { chunks, context, scores };
  }

  async removeSource(sourceId: string): Promise<void> {
    this.chunks = this.chunks.filter(c => c.metadata.sourceId !== sourceId);
  }

  stats(): { totalChunks: number; totalSources: number } {
    const sources = new Set(this.chunks.map(c => c.metadata.sourceId));
    return { totalChunks: this.chunks.length, totalSources: sources.size };
  }

  // ── 私有辅助 ──

  private detectSection(text: string): string | undefined {
    const match = text.match(/^第[一二三四五六七八九十百千]+[章节回]/);
    return match?.[0];
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    // 提取人名 (简单启发式)
    const names = text.match(/[A-Z一-鿿]{2,4}(?:说|道|问|答|喊|叫|嚷)/g);
    if (names) {
      for (const n of names) {
        tags.push(n.replace(/[说道问答喊叫嚷]/g, ''));
      }
    }
    return [...new Set(tags)].slice(0, 20);
  }
}

// ══════════════════════════════════════════════════════
// RAG Factory — 全局单例
// ══════════════════════════════════════════════════════

let defaultProvider: RAGProvider = new InMemoryRAGProvider();

export const RAGFactory = {
  getProvider(): RAGProvider {
    return defaultProvider;
  },

  setProvider(provider: RAGProvider): void {
    defaultProvider = provider;
  },

  async indexDocument(sourceId: string, content: string, options?: RAGIndexOptions): Promise<number> {
    return defaultProvider.indexDocument(sourceId, content, options);
  },

  async query(query: string, options?: RAGQueryOptions): Promise<RAGQueryResult> {
    return defaultProvider.query(query, options);
  },

  removeSource(sourceId: string): Promise<void> {
    return defaultProvider.removeSource(sourceId);
  },

  stats() {
    return defaultProvider.stats();
  },
};
