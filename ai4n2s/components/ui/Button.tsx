'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-black text-white border border-black hover:bg-white hover:text-black active:bg-gray-100',
  secondary:
    'bg-white text-black border border-black hover:bg-black hover:text-white active:bg-gray-900',
  danger:
    'bg-white text-black border border-black hover:bg-black hover:text-white active:bg-gray-900',
  ghost:
    'bg-transparent text-black border border-transparent hover:underline active:text-gray-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

/** 通用按钮组件，支持四种变体和两种尺寸 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium
        transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim()}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
