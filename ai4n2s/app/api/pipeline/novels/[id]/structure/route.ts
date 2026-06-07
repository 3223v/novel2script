/**
 * POST /api/pipeline/novels/[id]/structure
 *
 * 触发小说结构化管线。
 * Body: { strategy?: string }  — 默认 "default"
 *
 * 返回结构化的 NormalizedNovel。
 */

import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';
import NovelStructuringPipeline from '@/lib/pipeline/novel-structuring';
import { getNovelStructuringStrategies } from '@/lib/pipeline/types';

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
    try {
      const body = await request.json();
      if (body.strategy) strategyName = body.strategy;
    } catch {
      // 无 body 使用默认策略
    }

    // 执行管线
    const result = await NovelStructuringPipeline.execute(novel, strategyName);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/** GET — 获取可用的策略列表 */
export async function GET() {
  const strategies = getNovelStructuringStrategies().map(s => ({
    name: s.name,
    description: s.description,
  }));

  return NextResponse.json({ success: true, data: strategies });
}
