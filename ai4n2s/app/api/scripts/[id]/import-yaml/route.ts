import { NextRequest, NextResponse } from 'next/server';
import ScriptService from '@/lib/script-service';

type RouteParams = Promise<{ id: string }>;

// 从 YAML 导入
export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const yamlContent = await request.text();

    if (!yamlContent) {
      return NextResponse.json(
        { success: false, error: 'YAML 内容不能为空' },
        { status: 400 }
      );
    }

    const result = ScriptService.importFromYaml(id, yamlContent);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, error: '请求格式错误' },
      { status: 400 }
    );
  }
}
