'use client';

import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

/** 统计卡片：标签 + 大号 monospace 数值 + 边框 */
export default function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white wireframe-border p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-black">{icon}</span>}
      </div>
      <div className="text-2xl font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}
