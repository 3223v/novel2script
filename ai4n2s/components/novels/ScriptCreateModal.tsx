'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { Novel } from '@/lib/types';

interface ScriptCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  novelTitle?: string;
  novelAuthor?: string;
  novelId?: string;
  allowNoNovel?: boolean; // 允许不关联小说
}

export default function ScriptCreateModal({
  open, onClose, onCreated, novelTitle: preTitle, novelAuthor: preAuthor, novelId: preNovelId, allowNoNovel,
}: ScriptCreateModalProps) {
  const [version, setVersion] = useState('v1.0');
  const [submitting, setSubmitting] = useState(false);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState(preNovelId || '');
  const [novelTitle, setNovelTitle] = useState(preTitle || '');
  const [novelAuthor, setNovelAuthor] = useState(preAuthor || '');

  useEffect(() => {
    if (open && allowNoNovel) {
      fetch('/api/novels').then(r => r.json()).then(d => {
        if (d.success) setNovels(d.data);
      });
    }
  }, [open, allowNoNovel]);

  useEffect(() => {
    if (selectedNovelId) {
      const n = novels.find(n => n.id === selectedNovelId);
      if (n) { setNovelTitle(n.title); setNovelAuthor(n.author || ''); }
    }
  }, [selectedNovelId, novels]);

  const handleCreate = async () => {
    if (!version.trim()) return;
    setSubmitting(true);

    const scriptData = {
      script: {
        metadata: {
          title: `${novelTitle || '未命名'} - 剧本`,
          author: novelAuthor || '未知',
          based_on: novelTitle || '',
          version: version.trim(),
          date: new Date().toISOString().split('T')[0],
          logline: '',
          genre: [],
        },
        characters: [],
        scenes: [],
      },
    };

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelId: selectedNovelId || null, version: version.trim(), data: scriptData }),
      });
      const result = await response.json();
      if (result.success) {
        setVersion('v1.0');
        onClose();
        onCreated();
      } else {
        alert(`创建失败: ${result.error}`);
      }
    } catch (error) {
      console.error('创建剧本失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!submitting) { setVersion('v1.0'); onClose(); } }} title="创建新剧本" size="sm">
      <div className="space-y-4">
        <Input label="版本号" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="例如: v1.0, 导演剪辑版" autoFocus />
        {allowNoNovel && (
          <div>
            <label className="block text-sm font-medium text-black mb-1">关联小说（可选）</label>
            <select
              value={selectedNovelId}
              onChange={(e) => setSelectedNovelId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">— 不关联小说（独立剧本）—</option>
              {novels.map(n => <option key={n.id} value={n.id}>{n.title} ({n.author || '未知'})</option>)}
            </select>
          </div>
        )}
        {!allowNoNovel && preTitle && (
          <Input label="关联小说" value={preTitle} disabled />
        )}
        {selectedNovelId && (
          <Input label="作者" value={novelAuthor} onChange={(e) => setNovelAuthor(e.target.value)} />
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={() => { setVersion('v1.0'); onClose(); }} disabled={submitting}>取消</Button>
        <Button variant="primary" onClick={handleCreate} disabled={!version.trim() || submitting}>
          {submitting ? '创建中...' : '创建'}
        </Button>
      </div>
    </Modal>
  );
}
