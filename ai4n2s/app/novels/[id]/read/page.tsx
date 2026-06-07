'use client';

import { useState, useEffect, useCallback } from 'react';
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
    <div className="flex h-screen">
      {/* 左侧章节导航 */}
      <aside className="w-64 shrink-0 border-r border-black bg-gray-50 flex flex-col">
        {/* 头部 — 与侧栏品牌区同高 */}
        <div className="border-b border-black px-4" style={{ height: 56 }}>
          <button onClick={() => router.push('/novels')} className="text-xs text-gray-400 hover:text-black mt-1 block">
            ← 返回
          </button>
          <p className="text-sm font-bold font-mono truncate">{data.metadata.title}</p>
        </div>

        {/* 章节列表 */}
        <nav className="flex-1 overflow-y-auto">
          {data.chapters.map((ch, idx) => (
            <button
              key={idx}
              onClick={() => setActiveChapter(idx)}
              className={`
                w-full text-left px-4 py-2.5 text-sm border-b border-gray-200
                transition-colors duration-100
                ${idx === activeChapter
                  ? 'bg-white border-l-2 border-l-black font-semibold text-black'
                  : 'hover:bg-white text-gray-600 border-l-2 border-l-transparent'
                }
              `}
            >
              <span className="text-xs text-gray-400 mr-2 font-mono">{idx + 1}</span>
              <span className="truncate block">{ch.title}</span>
              <span className="text-xs text-gray-400 font-mono">{ch.content?.length?.toLocaleString() || 0} 字</span>
            </button>
          ))}
        </nav>

        {/* 底部 */}
        <div className="border-t border-black px-4 py-2">
          <a href={`/novels/${novelId}`} className="text-xs text-gray-400 hover:text-black">编辑 →</a>
        </div>
      </aside>

      {/* 右侧正文区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶栏 — 与侧栏头同高，包含元信息 */}
        <div className="border-b border-black px-8 flex items-center gap-6 shrink-0" style={{ height: 56 }}>
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
            {chapter.summary && (
              <span className="text-gray-400 italic max-w-xs truncate hidden lg:inline" title={chapter.summary}>
                {chapter.summary.slice(0, 40)}…
              </span>
            )}
            <span className="font-mono text-gray-400">{activeChapter + 1}/{data.chapters.length}</span>
          </div>
        </div>

        {/* 正文 */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 max-w-3xl mx-auto text-base leading-relaxed text-gray-900 whitespace-pre-wrap">
            {chapter.content || (
              <p className="text-gray-400 text-center py-16">此章暂无内容</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
