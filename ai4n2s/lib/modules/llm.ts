/**
 * LLM 调用模块 — 自动从环境变量 / 配置文件加载
 *
 * 优先级: 配置文件 > 环境变量 > Mock
 *
 * 使用方式:
 *   1. 创建 .env.local 文件，设置 OPENAI_API_KEY=sk-xxx
 *   2. 或在 /settings 页面配置
 *   3. 无需修改任何代码
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  extra?: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  readonly description: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  complete(prompt: string, options?: ChatOptions): Promise<ChatResult>;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom' | 'mock';
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ═══════════════════════════════════════════════════
// 配置加载
// ═══════════════════════════════════════════════════

const CONFIG_PATH = path.join(process.cwd(), 'data', 'llm-config.json');

function loadConfig(): LLMConfig {
  // 1. 尝试从配置文件加载
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const saved = JSON.parse(raw) as Partial<LLMConfig>;
      if (saved.apiKey && saved.apiKey !== 'YOUR_KEY_HERE') {
        return {
          provider: saved.provider || 'openai',
          baseUrl: saved.baseUrl || 'https://api.openai.com/v1',
          apiKey: saved.apiKey,
          model: saved.model || 'gpt-4o',
        };
      }
    }
  } catch { /* ignore */ }

  // 2. 从环境变量加载
  const envKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const envBase = process.env.OPENAI_BASE_URL || '';
  const envModel = process.env.OPENAI_MODEL || process.env.LLM_MODEL || '';

  if (envKey) {
    return {
      provider: envBase.includes('anthropic') ? 'anthropic' : 'openai',
      baseUrl: envBase || 'https://api.openai.com/v1',
      apiKey: envKey,
      model: envModel || 'gpt-4o',
    };
  }

  // 3. 检查常见的国产模型环境变量
  for (const [key, base] of [
    ['DASHSCOPE_API_KEY', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
    ['DEEPSEEK_API_KEY', 'https://api.deepseek.com/v1'],
    ['ZHIPU_API_KEY', 'https://open.bigmodel.cn/api/paas/v4'],
    ['MOONSHOT_API_KEY', 'https://api.moonshot.cn/v1'],
  ] as const) {
    if (process.env[key]) {
      return { provider: 'custom', baseUrl: base, apiKey: process.env[key]!, model: envModel || 'default' };
    }
  }

  // 4. Mock
  console.log('[LLM] 未检测到 API Key，使用 Mock 模式。在 .env.local 中设置 OPENAI_API_KEY 或访问 /settings 页面配置。');
  return { provider: 'mock', baseUrl: '', apiKey: '', model: 'mock' };
}

// ═══════════════════════════════════════════════════
// 通用 HTTP Provider
// ═══════════════════════════════════════════════════

class HttpLLMProvider implements LLMProvider {
  readonly name: string;
  readonly description = 'HTTP API Provider';

  constructor(
    private config: LLMConfig,
    name?: string,
  ) {
    this.name = name || config.provider;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        ...options?.extra,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LLM 调用失败 (${response.status}): ${err.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return {
      content,
      model: data.model || this.config.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }
}

class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly description = 'Mock — 未配置 API Key，返回占位内容';
  async chat(): Promise<ChatResult> {
    return { content: '[Mock] 请在 .env.local 中设置 OPENAI_API_KEY，或访问 /settings 页配置 LLM。', model: 'mock' };
  }
  async complete(): Promise<ChatResult> {
    return { content: '[Mock] 未配置 LLM', model: 'mock' };
  }
}

// ═══════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════

let provider: LLMProvider;

function initProvider(): LLMProvider {
  const config = loadConfig();
  if (config.provider === 'mock') return new MockProvider();
  return new HttpLLMProvider(config);
}

function getProvider(): LLMProvider {
  if (!provider) provider = initProvider();
  return provider;
}

export const LLMFactory = {
  getProvider,

  /** 重新加载配置（用户更新配置后调用） */
  reload(): LLMProvider {
    provider = initProvider();
    return provider;
  },

  /** 获取当前配置（用于 UI 展示） */
  getConfig(): LLMConfig {
    return loadConfig();
  },

  /** 保存配置到文件 */
  saveConfig(config: LLMConfig): void {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    provider = initProvider(); // 重新初始化
  },

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    return getProvider().chat(messages, options);
  },

  async complete(prompt: string, options?: ChatOptions): Promise<ChatResult> {
    return getProvider().complete(prompt, options);
  },
};
