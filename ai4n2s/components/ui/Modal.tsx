'use client';

import { type ReactNode, useEffect, useCallback } from 'react';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-4xl',
};

/** 通用模态框：固定遮罩 + 白色面板 + Esc 关闭 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/40" />

      {/* 面板 */}
      <div
        className={`
          relative z-10 bg-white wireframe-border wireframe-shadow
          w-full ${sizeClasses[size]}
          max-h-[90vh] flex flex-col overflow-hidden
        `}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black">
          <h3 className="text-lg font-semibold font-mono">{title}</h3>
          <button
            onClick={onClose}
            className="text-black hover:bg-black hover:text-white w-7 h-7 flex items-center justify-center border border-black text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
