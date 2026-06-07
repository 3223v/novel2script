import { NextRequest, NextResponse } from 'next/server';
import { LLMFactory } from '@/lib/modules/llm';

/** GET — 获取当前 LLM 配置（隐藏 apiKey 敏感部分） */
export async function GET() {
  const config = LLMFactory.getConfig();
  return NextResponse.json({
    success: true,
    data: {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      hasKey: !!config.apiKey,
      keyPreview: config.apiKey ? config.apiKey.slice(0, 7) + '...' + config.apiKey.slice(-4) : '',
    },
  });
}

/** PUT — 保存 LLM 配置 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, baseUrl, apiKey, model } = body;

    if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
      return NextResponse.json({ success: false, error: '请提供有效的 API Key' }, { status: 400 });
    }

    LLMFactory.saveConfig({
      provider: provider || 'openai',
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      apiKey,
      model: model || 'gpt-4o',
    });

    return NextResponse.json({ success: true, data: { message: '配置已保存并生效' } });
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }
}
