import { NextRequest, NextResponse } from 'next/server';
import ScriptService from '@/lib/script-service';

type RouteParams = Promise<{ id: string }>;

// 获取剧本详情和内容
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const script = ScriptService.getById(id);

  if (!script) {
    return NextResponse.json(
      { success: false, error: '剧本不存在' },
      { status: 404 }
    );
  }

  const contentResult = ScriptService.getContent(id);

  if (!contentResult.success) {
    return NextResponse.json(contentResult, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...script,
      content: contentResult.data,
    },
  });
}

// 更新剧本内容
export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data, version } = body;

    if (data) {
      const result = ScriptService.updateContent(id, data);
      if (!result.success) {
        return NextResponse.json(result, { status: 500 });
      }
    }

    if (version) {
      const result = ScriptService.updateVersion(id, version);
      if (!result.success) {
        return NextResponse.json(result, { status: 500 });
      }
    }

    const script = ScriptService.getById(id);
    return NextResponse.json({ success: true, data: script });
  } catch {
    return NextResponse.json(
      { success: false, error: '请求格式错误' },
      { status: 400 }
    );
  }
}

// 删除剧本
export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const result = ScriptService.delete(id);

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
