import { NextResponse } from 'next/server';
import { LLMFactory } from '@/lib/modules/llm';

export async function GET() {
  try {
    LLMFactory.reload();
    const config = LLMFactory.getConfig();

    if (config.provider === 'mock') {
      return NextResponse.json({
        success: false,
        error: '未配置 LLM。请在 .env.local 中设置 OPENAI_API_KEY 或在此页面填写 API Key。',
      });
    }

    const start = Date.now();
    const result = await LLMFactory.chat([
      { role: 'user', content: '请简单回复"OK"确认连接成功。' },
    ], { temperature: 0, maxTokens: 50 });
    const elapsed = Date.now() - start;

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        model: result.model,
        usage: result.usage,
        latency: `${elapsed}ms`,
        provider: config.provider,
        baseUrl: config.baseUrl.replace(/\/+$/, ''),
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: `连接失败: ${(err as Error).message}`,
    });
  }
}
