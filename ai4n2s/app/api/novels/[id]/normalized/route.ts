import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';
import NovelStructuringPipeline from '@/lib/pipeline/novel-structuring';
import fs from 'fs';
import path from 'path';

type RouteParams = Promise<{ id: string }>;

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

/** GET — 读取结构化小说 JSON */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const novel = NovelService.getById(id);

  if (!novel) {
    return NextResponse.json({ success: false, error: '小说不存在' }, { status: 404 });
  }

  const data = NovelStructuringPipeline.loadNormalizedData(id);

  if (!data) {
    return NextResponse.json({ success: false, error: '结构化数据不存在，请先执行结构化分析' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

/** PUT — 保存结构化小说 JSON */
export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const novel = NovelService.getById(id);

    if (!novel) {
      return NextResponse.json({ success: false, error: '小说不存在' }, { status: 404 });
    }

    const body = await request.json();
    const jsonStr = JSON.stringify(body, null, 2);

    // 验证 JSON 结构
    if (!body.metadata || !body.chapters) {
      return NextResponse.json(
        { success: false, error: '无效的结构化数据：缺少 metadata/chapters 字段' },
        { status: 400 }
      );
    }

    // 保存文件
    const novelDir = path.join(STORAGE_DIR, id);
    if (!fs.existsSync(novelDir)) {
      fs.mkdirSync(novelDir, { recursive: true });
    }

    const filePath = path.join(novelDir, 'normalized.json');
    fs.writeFileSync(filePath, jsonStr, 'utf-8');

    // 更新数据库状态
    NovelService.setNormalizedPath(id, path.join(id, 'normalized.json'));

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
