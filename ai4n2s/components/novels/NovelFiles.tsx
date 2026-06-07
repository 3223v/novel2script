'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { SourceFile } from '@/lib/types';

interface NovelFilesProps {
  novelId: string;
  files: SourceFile[];
  onUpdated: () => void;
}

interface StructuringProgress {
  stage: string;
  detail: string;
}

/** 源文件管理 — 列表 + 上传 + 结构化分析 */
export default function NovelFiles({ novelId, files, onUpdated }: NovelFilesProps) {
  const [uploading, setUploading] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [structProgress, setStructProgress] = useState<StructuringProgress | null>(null);
  const [structResult, setStructResult] = useState<string | null>(null);
  const [showStructModal, setShowStructModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);

    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await fetch(`/api/novels/${novelId}/files`, {
          method: 'POST',
          body: formData,
        });
      } catch (error) {
        console.error('上传文件失败:', error);
      }
    }

    setUploading(false);
    onUpdated();
    e.target.value = '';
  };

  const handleStructure = async (strategy: string) => {
    setStructuring(true);
    setShowStructModal(true);
    setStructProgress({ stage: 'start', detail: `启动结构化管线 (策略: ${strategy})...` });
    setStructResult(null);

    try {
      const response = await fetch(`/api/pipeline/novels/${novelId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });

      const result = await response.json();
      if (result.success) {
        setStructProgress({ stage: 'done', detail: `结构化完成！耗时 ${result.duration}ms` });
        setStructResult(
          JSON.stringify(
            {
              metadata: result.data.metadata,
              章节数: result.data.chapters?.length,
              角色数: result.data.characters?.length,
              地点数: result.data.locations?.length,
              场景数: result.data.scenes?.length,
              情节摘要: result.data.plot_summary?.slice(0, 200),
            },
            null,
            2
          )
        );
        onUpdated();
      } else {
        setStructProgress({ stage: 'error', detail: `结构化失败: ${result.error}` });
      }
    } catch (error) {
      setStructProgress({ stage: 'error', detail: `请求失败: ${(error as Error).message}` });
    } finally {
      setStructuring(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-sm font-mono uppercase tracking-wider">
          源文件
        </h4>
        <div className="flex gap-2">
          {files.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={structuring}
              onClick={() => { setStructResult(null); setStructProgress(null); setShowStructModal(true); }}
            >
              {structuring ? '分析中...' : '📋 结构化'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '上传中...' : '+ 上传文件'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>
      </div>

      <div className="border border-black">
        {files.length > 0 ? (
          <ul className="divide-y divide-black">
            {files.map((file, idx) => (
              <li key={idx} className="px-3 py-2 text-sm flex justify-between items-center">
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-gray-400 ml-2 shrink-0">{file.type || '—'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-sm text-gray-400">
            暂无源文件 — 上传文件后可执行结构化分析
          </div>
        )}
      </div>

      {/* 结构化进度弹窗 */}
      <Modal
        open={showStructModal}
        onClose={() => !structuring && setShowStructModal(false)}
        title="小说结构化分析"
        size="md"
      >
        <div className="space-y-4">
          {structProgress && (
            <div className={`p-3 border ${
              structProgress.stage === 'error' ? 'border-red-700 bg-red-50' :
              structProgress.stage === 'done' ? 'border-green-700 bg-green-50' :
              'border-black bg-gray-50'
            }`}>
              <p className="text-sm font-mono">
                {structProgress.stage === 'error' ? '✕ ' :
                 structProgress.stage === 'done' ? '✓ ' :
                 '○ '}
                {structProgress.detail}
              </p>
            </div>
          )}

          {!structuring && !structResult && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">选择分析策略:</p>
              <div className="grid gap-2">
                <button onClick={() => handleStructure('default')} className="text-left p-3 border border-black hover:bg-gray-50 text-sm">
                  <span className="font-semibold">默认策略</span>
                  <span className="text-gray-400 ml-2">— 仅提取基础元数据，快速完成</span>
                </button>
                <button onClick={() => handleStructure('regex')} className="text-left p-3 border border-black hover:bg-gray-50 text-sm">
                  <span className="font-semibold">正则分析</span>
                  <span className="text-gray-400 ml-2">— 正则匹配章节、角色、地点</span>
                </button>
                <button onClick={() => handleStructure('ai-workflow')} className="text-left p-3 border border-black hover:bg-gray-50 text-sm">
                  <span className="font-semibold">AI 工作流</span>
                  <span className="text-gray-400 ml-2">— 使用 LLM 深度分析 (需配置 LLM)</span>
                </button>
              </div>
            </div>
          )}

          {structResult && (
            <div>
              <p className="text-sm text-gray-500 mb-2">结构化结果预览:</p>
              <pre className="text-xs font-mono bg-gray-50 border border-black p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {structResult}
              </pre>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowStructModal(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
