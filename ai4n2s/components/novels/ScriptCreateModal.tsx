'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface ScriptCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  novelTitle: string;
  novelAuthor: string;
  novelId: string;
}

/** 创建剧本弹窗 */
export default function ScriptCreateModal({
  open,
  onClose,
  onCreated,
  novelTitle,
  novelAuthor,
  novelId,
}: ScriptCreateModalProps) {
  const [version, setVersion] = useState('v1.0');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!version.trim()) return;
    setSubmitting(true);

    const scriptData = {
      script: {
        metadata: {
          title: `${novelTitle} - 剧本`,
          author: novelAuthor,
          based_on: novelTitle,
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
        body: JSON.stringify({ novelId, version: version.trim(), data: scriptData }),
      });

      const result = await response.json();
      if (result.success) {
        setVersion('v1.0');
        onClose();
        onCreated();
      }
    } catch (error) {
      console.error('创建剧本失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setVersion('v1.0');
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="创建新剧本" size="sm">
      <div className="space-y-4">
        <Input
          label="版本号"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="例如: v1.0, 导演剪辑版"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!version.trim() || submitting}
        >
          {submitting ? '创建中...' : '创建'}
        </Button>
      </div>
    </Modal>
  );
}
