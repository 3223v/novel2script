import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';
import ScriptService from '@/lib/script-service';

type RouteParams = Promise<{ id: string }>;

// 获取小说详情
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const novel = NovelService.getById(id);

  if (!novel) {
    return NextResponse.json(
      { success: false, error: '小说不存在' },
      { status: 404 }
    );
  }

  // 获取关联的剧本
  const scriptsResult = ScriptService.getByNovelId(id);

  return NextResponse.json({
    success: true,
    data: {
      ...novel,
      scripts: scriptsResult.data || [],
    },
  });
}

// 更新小说状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, title, author } = body;

    if (status) {
      const result = NovelService.updateStatus(id, status);
      if (!result.success) return NextResponse.json(result, { status: 500 });
    }
    if (title) {
      NovelService.updateTitle(id, title);
    }
    if (author) {
      NovelService.updateAuthor(id, author);
    }

    const novel = NovelService.getById(id);
    return NextResponse.json({ success: true, data: novel });
  } catch {
    return NextResponse.json(
      { success: false, error: '请求格式错误' },
      { status: 400 }
    );
  }
}

// 删除小说
export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const result = NovelService.delete(id);

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
