'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import NovelCard from './NovelCard';
import NovelCreateModal from './NovelCreateModal';
import NovelDetail from './NovelDetail';
import type { Novel } from '@/lib/types';

interface NovelListProps {
  onCountChange?: (count: number) => void;
}

/** 小说列表 — 数据获取 + 编排 */
export default function NovelList({ onCountChange }: NovelListProps) {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);

  const fetchNovels = useCallback(async () => {
    try {
      const response = await fetch('/api/novels');
      const result = await response.json();
      if (result.success) {
        setNovels(result.data);
        onCountChange?.(result.data.length);
      }
    } catch (error) {
      console.error('获取小说列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchNovels();
  }, [fetchNovels]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这部小说吗？这将同时删除所有关联的剧本和文件。')) return;

    try {
      const response = await fetch(`/api/novels/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setNovels((prev) => prev.filter((n) => n.id !== id));
        onCountChange?.(novels.length - 1);
        if (selectedNovel?.id === id) {
          setSelectedNovel(null);
        }
      }
    } catch (error) {
      console.error('删除小说失败:', error);
    }
  };

  const handleNovelClick = (novel: Novel) => {
    setSelectedNovel(novel);
  };

  const handleDetailUpdate = async () => {
    fetchNovels();
    // 同步刷新当前选中小说，确保 UI 即时反映变更
    if (selectedNovel) {
      try {
        const response = await fetch(`/api/novels/${selectedNovel.id}`);
        const result = await response.json();
        if (result.success) {
          setSelectedNovel(result.data);
        }
      } catch (error) {
        console.error('刷新小说详情失败:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-gray-400 font-mono">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部操作栏 */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold font-mono uppercase tracking-wider">
          小说列表
          <span className="text-gray-400 ml-2 text-sm font-normal">
            {novels.length}
          </span>
        </h2>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            + 添加小说
          </Button>
        </div>
      </div>

      {/* 小说卡片列表 */}
      <div className="grid gap-3">
        {novels.map((novel) => (
          <NovelCard
            key={novel.id}
            novel={novel}
            selected={selectedNovel?.id === novel.id}
            onClick={() => handleNovelClick(novel)}
            onDelete={handleDelete}
          />
        ))}

        {novels.length === 0 && (
          <div className="text-center py-16 border border-black">
            <p className="text-gray-400 text-sm mb-4">暂无小说</p>
            <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
              + 添加第一部小说
            </Button>
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      <NovelCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchNovels}
      />

      {/* 详情面板 */}
      {selectedNovel && (
        <NovelDetail
          novel={selectedNovel}
          open={!!selectedNovel}
          onClose={() => setSelectedNovel(null)}
          onUpdate={handleDetailUpdate}
        />
      )}
    </div>
  );
}
