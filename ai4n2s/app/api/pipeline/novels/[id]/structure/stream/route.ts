/**
 * SSE 流式端点 — 实时推送小说结构化进度
 *
 * 使用 Server-Sent Events 协议，前端通过 EventSource 接收:
 *   event: progress  → data: { stage, detail }
 *   event: complete  → data: { result }
 *   event: error     → data: { error }
 */

import { NextRequest } from 'next/server';
import NovelService from '@/lib/novel-service';
import NovelStructuringPipeline from '@/lib/pipeline/novel-structuring';

type RouteParams = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  const novel = NovelService.getById(id);
  if (!novel) {
    return new Response('data: {"error":"小说不存在"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 404,
    });
  }

  const strategy = request.nextUrl.searchParams.get('strategy') || 'default';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await NovelStructuringPipeline.execute(novel, strategy, (stage, detail) => {
          send('progress', { stage, detail });
        });

        if (result.success) {
          send('complete', { result: result.data, strategy: result.strategy, duration: result.duration });
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
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
