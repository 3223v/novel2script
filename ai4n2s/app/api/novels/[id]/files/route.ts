import { NextRequest, NextResponse } from 'next/server';
import NovelService from '@/lib/novel-service';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

type RouteParams = Promise<{ id: string }>;

// 上传源文件
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      );
    }

    // 创建唯一文件名
    const ext = path.extname(file.name);
    const fileName = `${uuidv4()}${ext}`;
    const relativePath = path.join('sources', fileName);
    const fullPath = path.join(NovelService.getStoragePath(id), 'sources', fileName);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(fullPath, buffer);

    // 更新数据库
    const sourceFile = {
      name: file.name,
      path: relativePath,
      type: file.type || 'application/octet-stream',
    };

    NovelService.addSourceFile(id, sourceFile);

    return NextResponse.json({
      success: true,
      data: sourceFile,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
