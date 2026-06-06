import { NextRequest, NextResponse } from 'next/server';
import ScriptService from '@/lib/script-service';

type RouteParams = Promise<{ id: string }>;

// 导出为 YAML
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id } = await params;
  const result = ScriptService.exportToYaml(id);

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return new NextResponse(result.data, {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Content-Disposition': `attachment; filename="script-${id}.yaml"`,
    },
  });
}
