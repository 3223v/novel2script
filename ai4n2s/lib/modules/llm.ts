/**
 * LLM 调用模块 — 大语言模型抽象层
 *
 * 采用适配器模式:
 *   LLMProvider (接口) ← OpenAIAdapter / AnthropicAdapter / MockAdapter / ...
 *
 * 默认使用 MockAdapter，返回占位内容。
 * 扩展时实现 LLMProvider 接口并注册到 LLMFactory。
 */

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** 模型名称 */
  model?: string;
  /** 温度 (0-2)，越低越确定 */
  temperature?: number;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 额外参数透传 */
  extra?: Record<string, unknown>;
}

export interface ChatResult {
  /** 生成的文本 */
  content: string;
  /** 使用的模型 */
  model: string;
  /** token 用量 (如果提供方返回) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ══════════════════════════════════════════════════════
// Provider 接口 (策略/适配器模式)
// ══════════════════════════════════════════════════════

export interface LLMProvider {
  readonly name: string;
  readonly description: string;

  /** 单轮对话 */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;

  /** 便捷方法: 单条 prompt */
  complete(prompt: string, options?: ChatOptions): Promise<ChatResult>;
}

// ══════════════════════════════════════════════════════
// Mock Provider (默认实现)
// ══════════════════════════════════════════════════════

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly description = 'Mock LLM 提供器 — 返回占位内容，用于测试和默认行为';

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const promptPreview = lastUserMessage?.content?.slice(0, 80) || '（无内容）';

    return {
      content: `[Mock LLM Response]\n收到 ${messages.length} 条消息。\n最后一条用户消息: "${promptPreview}..."\n\n请配置真实的 LLM Provider 以获取实际生成内容。`,
      model: options?.model || 'mock/v0',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

// ══════════════════════════════════════════════════════
// LLM Factory — 全局单例
// ══════════════════════════════════════════════════════

let defaultProvider: LLMProvider = new MockLLMProvider();

export const LLMFactory = {
  /** 获取当前默认 provider */
  getProvider(): LLMProvider {
    return defaultProvider;
  },

  /** 设置全局 provider (用于切换到真实 LLM) */
  setProvider(provider: LLMProvider): void {
    defaultProvider = provider;
  },

  /** 便捷: 直接用默认 provider 对话 */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    return defaultProvider.chat(messages, options);
  },

  /** 便捷: 直接用默认 provider 生成 */
  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return defaultProvider.complete(prompt, options);
  },
};

// ══════════════════════════════════════════════════════
// 预置: OpenAI 兼容 Provider 骨架
// ══════════════════════════════════════════════════════

/**
 * OpenAI 兼容的 LLM Provider 骨架。
 *
 * 使用方式:
 *   const provider = new OpenAICompatibleProvider({
 *     baseUrl: 'https://api.openai.com/v1',
 *     apiKey: process.env.OPENAI_API_KEY!,
 *     defaultModel: 'gpt-4o',
 *   });
 *   LLMFactory.setProvider(provider);
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  readonly description = 'OpenAI API 兼容提供器 (GPT-4o, Claude API, 本地模型等)';

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(config: { baseUrl: string; apiKey: string; defaultModel?: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'gpt-4o';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        ...options?.extra,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API 调用失败 (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || options?.model || this.defaultModel,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}
