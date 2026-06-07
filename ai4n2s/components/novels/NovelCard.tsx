'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { Novel } from '@/lib/types';

interface NovelCardProps {
  novel: Novel;
  selected: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
  uploading: { label: '上传中', variant: 'warning' },
  analyzing: { label: '分析中', variant: 'default' },
  ready: { label: '就绪', variant: 'success' },
  error: { label: '错误', variant: 'error' },
};

/** 小说卡片：信息展示 + 状态标签 + 操作 */
export default function NovelCard({ novel, selected, onClick, onDelete }: NovelCardProps) {
  const status = statusLabels[novel.status] || statusLabels.uploading;
  const updatedAt = new Date(novel.updated_at).toLocaleString('zh-CN');

  return (
    <Card selected={selected} hoverable onClick={onClick} className="p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{novel.title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            作者: {novel.author || '未知'} · 更新: {updatedAt}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge label={status.label} variant={status.variant} />
            <span className="text-xs text-gray-400">
              {novel.source_files.length} 个源文件
            </span>
            {novel.normalized_path && (
              <Link
                href={`/novels/${novel.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-gray-500 hover:text-black hover:underline"
              >
                查看结构化数据 →
              </Link>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(novel.id);
          }}
          className="ml-2 px-2 py-1 text-xs text-gray-400 hover:text-black hover:bg-black hover:text-white border border-transparent hover:border-black transition-colors shrink-0"
        >
          删除
        </button>
      </div>
    </Card>
  );
}
