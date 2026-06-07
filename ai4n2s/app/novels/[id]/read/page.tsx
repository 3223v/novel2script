'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { NormalizedNovel } from '@/lib/types';

/** 小说阅读页 — 左侧章节导航 + 右侧正文 */
export default function NovelReaderPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = params.id as string;

  const [data, setData] = useState<NormalizedNovel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeChapter]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/novels/${novelId}/normalized`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '结构化数据不存在，请先执行结构化分析');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 键盘导航
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!data) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setActiveChapter((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setActiveChapter((prev) => Math.min(data.chapters.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-gray-400 font-mono">加载中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500 mb-4">{error || '数据加载失败'}</p>
        <button onClick={() => router.push('/novels')} className="px-4 py-2 text-sm border border-black hover:bg-black hover:text-white">
          ← 返回
        </button>
      </div>
    );
  }

  const chapter = data.chapters[activeChapter];
  if (!chapter) return null;

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 — 章节名称 + 元信息 + 字体大小调节 */}
      <div className="border-b border-black px-8 flex items-center gap-6 shrink-0" style={{ height: 56 }}>
        <button onClick={() => router.push('/novels')} className="text-xs text-gray-400 hover:text-black shrink-0">
          ← 返回
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold font-mono truncate">{chapter.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
          {chapter.characters.length > 0 && (
            <span title={`角色: ${chapter.characters.join('、')}`}>
              角色: {chapter.characters.slice(0, 5).join('、')}{chapter.characters.length > 5 ? ` +${chapter.characters.length - 5}` : ''}
            </span>
          )}
          {chapter.locations.length > 0 && (
            <span title={`地点: ${chapter.locations.join('、')}`}>
              地点: {chapter.locations.slice(0, 4).join('、')}{chapter.locations.length > 4 ? ` +${chapter.locations.length - 4}` : ''}
            </span>
          )}
          {/* 字体大小调节 */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="w-6 h-6 flex items-center justify-center text-sm font-mono hover:bg-black hover:text-white border border-gray-300"
            >
              A−
            </button>
            <span className="font-mono text-gray-400 w-8 text-center">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(28, s + 1))}
              className="w-6 h-6 flex items-center justify-center text-sm font-mono hover:bg-black hover:text-white border border-gray-300"
            >
              A+
            </button>
          </div>
          <span className="font-mono text-gray-400">{activeChapter + 1}/{data.chapters.length}</span>
          {activeChapter > 0 && (
            <button
              onClick={() => setActiveChapter(activeChapter - 1)}
              className="text-xs text-gray-500 hover:text-black"
            >
              ← 上一章
            </button>
          )}
          {activeChapter < data.chapters.length - 1 && (
            <button
              onClick={() => setActiveChapter(activeChapter + 1)}
              className="text-xs text-gray-500 hover:text-black"
            >
              下一章 →
            </button>
          )}
        </div>
      </div>

      {/* 正文 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="px-8 py-10 max-w-3xl mx-auto leading-relaxed text-gray-900"
          style={{ fontSize: `${fontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
        >
          {chapter.content || (
            <p className="text-gray-400 text-center py-16">此章暂无内容</p>
          )}
        </div>
      </div>
    </div>
  );
}
