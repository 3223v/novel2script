'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import type { Novel } from '@/lib/types';

interface NovelInfoProps {
  novel: Novel;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
  uploading: { label: '上传中', variant: 'warning' },
  analyzing: { label: '分析中', variant: 'default' },
  ready: { label: '就绪', variant: 'success' },
  error: { label: '错误', variant: 'error' },
};

/** 小说基本信息 — 表格布局 */
export default function NovelInfo({ novel }: NovelInfoProps) {
  const status = statusLabels[novel.status] || statusLabels.uploading;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: '作者', value: novel.author || '未知' },
    { label: '状态', value: <Badge label={status.label} variant={status.variant} /> },
    { label: '创建时间', value: new Date(novel.created_at).toLocaleString('zh-CN') },
    { label: '更新时间', value: new Date(novel.updated_at).toLocaleString('zh-CN') },
    { label: '源文件数', value: `${novel.source_files.length}` },
    {
      label: '结构化数据',
      value: novel.normalized_path ? (
        <Link href={`/novels/${novel.id}`} className="text-xs hover:underline hover:text-black text-gray-600">
          查看 / 编辑 →
        </Link>
      ) : (
        <span className="text-xs text-gray-400">未生成</span>
      ),
    },
  ];

  return (
    <div>
      <h4 className="font-semibold text-sm mb-3 font-mono uppercase tracking-wider">
        基本信息
      </h4>
      <div className="border border-black">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center border-b border-black last:border-b-0"
          >
            <span className="w-28 shrink-0 px-3 py-2 text-xs text-gray-500 border-r border-black bg-gray-50">
              {row.label}
            </span>
            <span className="px-3 py-2 text-sm">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
