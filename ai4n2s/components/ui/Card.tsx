'use client';

import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

/** 通用卡片容器：白色背景 + 黑色边框，支持悬浮阴影和选中态 */
export default function Card({
  children,
  className = '',
  hoverable = false,
  onClick,
  selected = false,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white wireframe-border
        ${selected ? 'wireframe-shadow-sm' : ''}
        ${hoverable ? 'hover:wireframe-shadow-sm cursor-pointer transition-shadow duration-150' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
