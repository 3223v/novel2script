'use client';

import { useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import type { Novel } from '@/lib/types';

interface NovelInfoProps {
  novel: Novel;
  onUpdate: () => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
  uploading: { label: '上传中', variant: 'warning' },
  analyzing: { label: '分析中', variant: 'default' },
  ready: { label: '就绪', variant: 'success' },
  error: { label: '错误', variant: 'error' },
};

/** 小说基本信息 — 表格布局，支持内联编辑标题和作者 */
export default function NovelInfo({ novel, onUpdate }: NovelInfoProps) {
  const status = statusLabels[novel.status] || statusLabels.uploading;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(novel.title);
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorVal, setAuthorVal] = useState(novel.author || '');

  const saveField = async (field: string, value: string) => {
    await fetch(`/api/novels/${novel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    onUpdate();
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: '书名',
      value: editingTitle ? (
        <input
          value={titleVal} onChange={(e) => setTitleVal(e.target.value)}
          onBlur={() => { setEditingTitle(false); if (titleVal !== novel.title) saveField('title', titleVal); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setEditingTitle(false); if (titleVal !== novel.title) saveField('title', titleVal); } }}
          className="px-2 py-0.5 text-sm border border-black focus:outline-none focus:ring-1 focus:ring-black"
          autoFocus
        />
      ) : (
        <span className="cursor-pointer hover:bg-gray-100 px-1" onClick={() => setEditingTitle(true)} title="点击编辑书名">
          {novel.title} ✎
        </span>
      ),
    },
    {
      label: '作者',
      value: editingAuthor ? (
        <input
          value={authorVal} onChange={(e) => setAuthorVal(e.target.value)}
          onBlur={() => { setEditingAuthor(false); if (authorVal !== (novel.author || '')) saveField('author', authorVal); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setEditingAuthor(false); if (authorVal !== (novel.author || '')) saveField('author', authorVal); } }}
          className="px-2 py-0.5 text-sm border border-black focus:outline-none focus:ring-1 focus:ring-black"
          autoFocus
        />
      ) : (
        <span className="cursor-pointer hover:bg-gray-100 px-1" onClick={() => setEditingAuthor(true)} title="点击编辑作者">
          {novel.author || '未知'} ✎
        </span>
      ),
    },
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
