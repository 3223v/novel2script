import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';

// 获取所有小说
export async function GET() {
  const result = NovelService.getAll();

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

// 创建新小说
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, author } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: '标题不能为空' },
        { status: 400 }
      );
    }

    const result = NovelService.create(title, author || '');

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: '请求格式错误' },
      { status: 400 }
    );
  }
}
