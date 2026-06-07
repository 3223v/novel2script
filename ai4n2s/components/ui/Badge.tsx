'use client';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

const variantMarkers: Record<string, string> = {
  default: 'border-l-black',
  success: 'border-l-green-700',
  warning: 'border-l-yellow-700',
  error: 'border-l-red-700',
};

/** 状态标签：白色背景 + 黑色边框 + 左侧彩色指示条 */
export default function Badge({
  label,
  variant = 'default',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-block px-2 py-0.5 text-xs font-medium
        bg-white text-black wireframe-border
        border-l-2 ${variantMarkers[variant]}
        ${className}
      `.trim()}
    >
      {label}
    </span>
  );
}
