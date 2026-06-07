'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface NovelCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** 创建小说弹窗表单 */
export default function NovelCreateModal({ open, onClose, onCreated }: NovelCreateModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/novels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), author: author.trim() }),
      });

      const result = await response.json();
      if (result.success) {
        setTitle('');
        setAuthor('');
        onClose();
        onCreated();
      }
    } catch (error) {
      console.error('创建小说失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setTitle('');
      setAuthor('');
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="添加新小说" size="sm">
      <div className="space-y-4">
        <Input
          label="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入小说标题"
          required
          autoFocus
        />
        <Input
          label="作者"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="输入作者名称（选填）"
        />
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!title.trim() || submitting}
        >
          {submitting ? '创建中...' : '创建'}
        </Button>
      </div>
    </Modal>
  );
}
