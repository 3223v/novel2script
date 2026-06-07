'use client';

import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/** 输入框组件：白色背景 + 黑色边框 + 标签 + 错误提示 */
export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-black"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2 text-sm
          bg-white text-black
          border border-black
          focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0
          placeholder:text-gray-400
          disabled:opacity-40 disabled:cursor-not-allowed
          ${error ? 'border-l-2 border-l-red-700' : ''}
          ${className}
        `.trim()}
        {...props}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
