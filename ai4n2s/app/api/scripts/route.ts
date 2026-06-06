import { NextRequest, NextResponse } from 'next/server';
import ScriptService from '@/lib/script-service';

// 创建新剧本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { novelId, version, data } = body;

    if (!novelId || !version || !data) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: novelId, version, data' },
        { status: 400 }
      );
    }

    const result = ScriptService.create(novelId, version, data);

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
