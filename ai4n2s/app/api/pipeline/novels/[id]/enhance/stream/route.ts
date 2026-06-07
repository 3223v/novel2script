/** SSE 流式端点 — AI 增强进度 */
import { NextRequest } from 'next/server';
import { NovelEnhancementPipeline } from '@/lib/pipeline/novel-enhancement';

type RouteParams = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await NovelEnhancementPipeline.execute(id, (progress) => {
          send('progress', progress);
        });

        if (result.success) {
          send('complete', { data: result.data });
        } else {
          send('error', { error: result.error });
        }
      } catch (err) {
        send('error', { error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
