/**
 * POST /api/pipeline/scripts/[id]/generate
 *
 * 触发剧本生成管线。
 * Body: { strategy?: string }  — 默认 "default"
 *
 * 注意: [id] 为 novel ID，非 script ID。
 * 生成成功后自动创建新的 Script 记录。
 */

import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';
import ScriptGenerationPipeline from '@/lib/pipeline/script-generation';
import { getScriptGenerationStrategies } from '@/lib/pipeline/types';

type RouteParams = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const novel = NovelService.getById(id);

    if (!novel) {
      return NextResponse.json(
        { success: false, error: '小说不存在' },
        { status: 404 }
      );
    }

    // 解析请求
    let strategyName = 'default';
    let version = 'v1.0';
    try {
      const body = await request.json();
      if (body.strategy) strategyName = body.strategy;
      if (body.version) version = body.version;
    } catch {
      // 无 body 使用默认
    }

    // 执行管线
    const result = await ScriptGenerationPipeline.execute(
      novel,
      version,
      strategyName
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/** GET — 获取可用的策略列表 */
export async function GET() {
  const strategies = getScriptGenerationStrategies().map(s => ({
    name: s.name,
    description: s.description,
  }));

  return NextResponse.json({ success: true, data: strategies });
}
