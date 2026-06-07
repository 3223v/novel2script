'use client';

interface SidebarToggleProps {
  onClick: () => void;
  visible: boolean;
}

/** 侧栏收起后显示的展开按钮 */
export default function SidebarToggle({ onClick, visible }: SidebarToggleProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={`
        fixed top-3 left-3 z-50
        w-9 h-9
        bg-white wireframe-border
        flex items-center justify-center
        hover:bg-black hover:text-white
        transition-colors duration-150
      `}
      title="展开导航"
    >
      <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      >
        <line x1="1" y1="1" x2="15" y2="1" />
        <line x1="1" y1="6" x2="15" y2="6" />
        <line x1="1" y1="11" x2="15" y2="11" />
      </svg>
    </button>
  );
}
