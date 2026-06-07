'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ScriptCreateModal from './ScriptCreateModal';
import type { Script } from '@/lib/types';

interface NovelScriptsProps {
  novelId: string;
  novelTitle: string;
  novelAuthor: string;
}

/** 剧本列表 — 展示 + 创建 + 导出 + 删除 */
export default function NovelScripts({ novelId, novelTitle, novelAuthor }: NovelScriptsProps) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const response = await fetch(`/api/novels/${novelId}`);
      const result = await response.json();
      if (result.success) {
        setScripts(result.data.scripts || []);
      }
    } catch (error) {
      console.error('获取剧本列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

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

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-sm font-mono uppercase tracking-wider">
          剧本列表
        </h4>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          + 创建剧本
        </Button>
      </div>

      <div className="border border-black">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-400">加载中...</div>
        ) : scripts.length > 0 ? (
          <ul className="divide-y divide-black">
            {scripts.map((script) => (
              <li key={script.id} className="px-3 py-3 flex justify-between items-center">
                <div>
                  <Link
                    href={`/scripts/${script.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {script.version}
                  </Link>
                  <span className="text-gray-400 text-xs ml-2">
                    {new Date(script.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport(script.id)}
                    className="text-xs text-gray-600 hover:text-black hover:underline"
                  >
                    导出 YAML
                  </button>
                  <button
                    onClick={() => handleDelete(script.id)}
                    className="text-xs text-gray-400 hover:text-black"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-sm text-gray-400">暂无剧本</div>
        )}
      </div>

      <ScriptCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchScripts}
        novelTitle={novelTitle}
        novelAuthor={novelAuthor}
        novelId={novelId}
      />
    </div>
  );
}
