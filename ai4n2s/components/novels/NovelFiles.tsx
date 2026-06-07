'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { SourceFile } from '@/lib/types';

interface NovelFilesProps {
  novelId: string;
  files: SourceFile[];
  onUpdated: () => void;
  hasNormalized: boolean;
}

interface ProgressEvent { stage: string; detail: string; current?: number; total?: number; }

export default function NovelFiles({ novelId, files, onUpdated, hasNormalized }: NovelFilesProps) {
  const [uploading, setUploading] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [structProgress, setStructProgress] = useState<ProgressEvent | null>(null);
  const [structResult, setStructResult] = useState<string | null>(null);
  const [showStructModal, setShowStructModal] = useState(false);
  const [strategies, setStrategies] = useState<Array<{ name: string; description: string }>>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState<ProgressEvent | null>(null);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStrategies = () => {
    fetch(`/api/pipeline/novels/${novelId}/structure`)
      .then((r) => r.json())
      .then((data) => { if (data.success && data.data) setStrategies(data.data); })
      .catch(() => {});
  };

  // 使用 SSE 进行结构化
  const startStructure = (strategy: string) => {
    setStructuring(true);
    setStructProgress({ stage: 'start', detail: '连接 SSE 流...' });
    setStructResult(null);

    const es = new EventSource(`/api/pipeline/novels/${novelId}/structure/stream?strategy=${encodeURIComponent(strategy)}`);
    es.addEventListener('progress', (e) => { setStructProgress(JSON.parse(e.data)); });
    es.addEventListener('complete', (e) => {
      const d = JSON.parse(e.data);
      setStructProgress({ stage: 'done', detail: `完成! 耗时 ${d.duration}ms` });
      setStructResult(JSON.stringify({ 章节数: d.result?.chapters?.length, 角色数: d.result?.characters?.length, 情节摘要: d.result?.plot_summary?.slice(0, 200) }, null, 2));
      setStructuring(false);
      onUpdated();
      es.close();
    });
    es.addEventListener('error', (e) => {
      try { const d = JSON.parse((e as MessageEvent).data); setStructProgress({ stage: 'error', detail: d.error }); } catch { setStructProgress({ stage: 'error', detail: '连接失败' }); }
      setStructuring(false);
      es.close();
    });
  };

  // AI 增强
  const startEnhance = () => {
    setEnhancing(true);
    setShowEnhanceModal(true);
    setEnhanceProgress({ stage: 'start', detail: '连接 SSE 流...' });

    const es = new EventSource(`/api/pipeline/novels/${novelId}/enhance/stream`);
    es.addEventListener('progress', (e) => { setEnhanceProgress(JSON.parse(e.data)); });
    es.addEventListener('complete', () => {
      setEnhanceProgress({ stage: 'done', detail: 'AI 增强完成!' });
      setEnhancing(false);
      onUpdated();
      es.close();
    });
    es.addEventListener('error', (e) => {
      try { const d = JSON.parse((e as MessageEvent).data); setEnhanceProgress({ stage: 'error', detail: d.error }); } catch { setEnhanceProgress({ stage: 'error', detail: '连接失败' }); }
      setEnhancing(false);
      es.close();
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData(); formData.append('file', file);
      try { await fetch(`/api/novels/${novelId}/files`, { method: 'POST', body: formData }); } catch (err) { console.error('上传失败:', err); }
    }
    setUploading(false);
    onUpdated();
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-sm font-mono uppercase tracking-wider">源文件</h4>
        <div className="flex gap-2">
          {hasNormalized && (
            <Button variant="secondary" size="sm" disabled={enhancing} onClick={startEnhance}>
              {enhancing ? '增强中...' : '✨ AI 增强'}
            </Button>
          )}
          {files.length > 0 && (
            <Button variant="secondary" size="sm" disabled={structuring} onClick={() => { setStructResult(null); setStructProgress(null); loadStrategies(); setShowStructModal(true); }}>
              {structuring ? '分析中...' : '📋 结构化'}
            </Button>
          )}
          <Button variant="primary" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? '上传中...' : '+ 上传文件'}
          </Button>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} disabled={uploading} className="hidden" />
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
          <div className="p-4 text-center text-sm text-gray-400">暂无源文件 — 上传文件后可执行结构化分析</div>
        )}
      </div>

      {/* 结构化弹窗 */}
      <Modal open={showStructModal} onClose={() => !structuring && setShowStructModal(false)} title="小说结构化分析" size="md">
        <div className="space-y-4">
          {structProgress && (
            <div className={`p-3 border ${structProgress.stage === 'error' ? 'border-red-700 bg-red-50' : structProgress.stage === 'done' ? 'border-green-700 bg-green-50' : 'border-black bg-gray-50'}`}>
              <p className="text-sm font-mono">{structProgress.stage === 'error' ? '✕ ' : structProgress.stage === 'done' ? '✓ ' : '⟳ '}{structProgress.detail}</p>
              {structProgress.current && <div className="mt-1 h-1 bg-gray-200"><div className="h-1 bg-black" style={{ width: `${(structProgress.current / (structProgress.total || 1)) * 100}%` }} /></div>}
            </div>
          )}
          {!structuring && !structResult && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">选择分析策略:</p>
              <div className="grid gap-2">
                {strategies.map((s) => (
                  <button key={s.name} onClick={() => startStructure(s.name)} className="text-left p-3 border border-black hover:bg-gray-50 text-sm">
                    <span className="font-semibold">{s.name}</span><span className="text-gray-400 ml-2">— {s.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {structResult && (
            <div>
              <p className="text-sm text-gray-500 mb-2">结构化结果预览:</p>
              <pre className="text-xs font-mono bg-gray-50 border border-black p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">{structResult}</pre>
            </div>
          )}
          <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => setShowStructModal(false)}>关闭</Button></div>
        </div>
      </Modal>

      {/* AI 增强弹窗 */}
      <Modal open={showEnhanceModal} onClose={() => !enhancing && setShowEnhanceModal(false)} title="AI 增强" size="md">
        <div className="space-y-4">
          {enhanceProgress && (
            <div className={`p-3 border ${enhanceProgress.stage === 'error' ? 'border-red-700 bg-red-50' : enhanceProgress.stage === 'done' ? 'border-green-700 bg-green-50' : 'border-black bg-gray-50'}`}>
              <p className="text-sm font-mono">{enhanceProgress.stage === 'error' ? '✕ ' : enhanceProgress.stage === 'done' ? '✓ ' : '⟳ '}{enhanceProgress.detail}</p>
              {enhanceProgress.current != null && enhanceProgress.total && (
                <div className="mt-1 h-1 bg-gray-200"><div className="h-1 bg-black" style={{ width: `${(enhanceProgress.current / enhanceProgress.total) * 100}%` }} /></div>
              )}
            </div>
          )}
          <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => setShowEnhanceModal(false)}>关闭</Button></div>
        </div>
      </Modal>
    </div>
  );
}
