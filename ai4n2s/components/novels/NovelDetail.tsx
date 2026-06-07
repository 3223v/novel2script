'use client';

import Modal from '@/components/ui/Modal';
import NovelInfo from './NovelInfo';
import NovelFiles from './NovelFiles';
import NovelScripts from './NovelScripts';
import type { Novel } from '@/lib/types';

interface NovelDetailProps {
  novel: Novel;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

/** 小说详情面板 — 组合基本信息 + 源文件 + 剧本 */
export default function NovelDetail({ novel, open, onClose, onUpdate }: NovelDetailProps) {
  return (
    <Modal open={open} onClose={onClose} title={novel.title} size="lg">
      <div className="space-y-6">
        <NovelInfo novel={novel} onUpdate={onUpdate} />
        <NovelFiles novelId={novel.id} files={novel.source_files} onUpdated={onUpdate} hasNormalized={!!novel.normalized_path} />
        <NovelScripts novelId={novel.id} novelTitle={novel.title} novelAuthor={novel.author} />
      </div>
    </Modal>
  );
}
