'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import ScriptCreateModal from '@/components/novels/ScriptCreateModal';
import type { Script, Novel } from '@/lib/types';

interface ScriptWithNovel extends Script {
  novel_title?: string;
}

/** 剧本管理页 — 全部剧本列表 */
export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptWithNovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');

  const fetchAll = useCallback(async () => {
    try {
      // 获取全部小说（供下拉框使用）
      const novelsRes = await fetch('/api/novels');
      const novelsData = await novelsRes.json();
      setNovels(novelsData.success ? novelsData.data : []);

      // 获取全部剧本（含独立剧本）
      const scriptsRes = await fetch('/api/scripts');
      const scriptsData = await scriptsRes.json();
      setScripts(scriptsData.success ? scriptsData.data : []);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (scriptId: string) => {
    if (!confirm('确定要删除这个剧本吗？')) return;

    try {
      const response = await fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setScripts((prev) => prev.filter((s) => s.id !== scriptId));
      }
    } catch (error) {
      console.error('删除剧本失败:', error);
    }
  };

  const handleExport = (scriptId: string) => {
    window.open(`/api/scripts/${scriptId}/export-yaml`, '_blank');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-400 font-mono">加载剧本列表...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">剧本管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            浏览、生成和编辑所有小说的剧本
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + 创建剧本
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="剧本总数" value={scripts.length} />
        <StatCard label="关联小说" value={novels.length} />
        <StatCard label="格式" value="YAML + JSON" />
      </div>

      {/* 剧本列表 */}
      {scripts.length > 0 ? (
        <div className="grid gap-3">
          {scripts.map((script) => (
            <Link
              key={script.id}
              href={`/scripts/${script.id}`}
              className="block bg-white wireframe-border p-4 hover:wireframe-shadow transition-shadow duration-150"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-base">
                    {script.novel_title || '未知小说'} — {script.version}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    格式: {script.format} · 创建于: {new Date(script.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(script.id); }}
                    className="text-xs text-gray-600 hover:text-black hover:underline"
                  >
                    导出
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(script.id); }}
                    className="text-xs text-gray-400 hover:text-black"
                  >
                    删除
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-black">
          <p className="text-gray-400 text-sm mb-4">暂无剧本</p>
          <p className="text-gray-400 text-xs">
            前往小说详情页创建剧本，或点击上方按钮
          </p>
        </div>
      )}

      {/* 创建剧本弹窗 — 无论是否有小说，均可创建独立剧本 */}
      {showCreateModal && (
        <ScriptCreateModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchAll}
          allowNoNovel
        />
      )}
    </div>
  );
}
