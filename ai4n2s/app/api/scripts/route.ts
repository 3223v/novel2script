import { NextRequest, NextResponse } from 'next/server';
import ScriptService from '@/lib/script-service';
import NovelService from '@/lib/novel-service';

// 获取所有剧本（含独立剧本）
export async function GET() {
  // 获取关联剧本
  const novels = NovelService.getAll();
  const allScripts: Array<{ id: string; novel_id: string | null; version: string; format: string; created_at: number; novel_title?: string }> = [];

  if (novels.success && novels.data) {
    for (const novel of novels.data) {
      const res = ScriptService.getByNovelId(novel.id);
      if (res.success && res.data) {
        for (const s of res.data) {
          allScripts.push({ ...s, novel_title: novel.title });
        }
      }
    }
  }

  // 获取独立剧本
  const standalone = ScriptService.getStandalone();
  if (standalone.success && standalone.data) {
    for (const s of standalone.data) {
      allScripts.push({ ...s, novel_title: undefined });
    }
  }

  return NextResponse.json({ success: true, data: allScripts });
}

// 创建新剧本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { novelId, version, data } = body;

    if (!version || !data) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: version, data' },
        { status: 400 }
      );
    }

    // novelId 可选 — 允许创建独立剧本
    const targetNovelId = novelId || undefined;

    const result = ScriptService.create(targetNovelId, version, data);

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
