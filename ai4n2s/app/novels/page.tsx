'use client';

import { useState } from 'react';
import StatCard from '@/components/ui/StatCard';
import NovelList from '@/components/novels/NovelList';

/** 小说管理页 — 统计卡片 + 小说列表 */
export default function NovelsPage() {
  const [novelCount, setNovelCount] = useState<number>(0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono tracking-tight">小说管理</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理小说作品，上传源文件，创建剧本
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="总小说数" value={novelCount} icon="📖" />
        <StatCard label="存储路径" value="data/storage/" />
        <StatCard label="数据引擎" value="SQLite + YAML" />
      </div>

      {/* 小说列表（含增删改查） */}
      <NovelList onCountChange={setNovelCount} />
    </div>
  );
}
