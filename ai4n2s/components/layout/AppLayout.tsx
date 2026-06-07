'use client';

import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import SidebarToggle from './SidebarToggle';

interface AppLayoutProps {
  children: ReactNode;
}

/** 应用根布局：管理侧栏展开/收起状态 */
export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <SidebarToggle
        visible={!sidebarOpen}
        onClick={() => setSidebarOpen(true)}
      />

      {/* 主内容区 — 侧栏展开时向右偏移 */}
      <main
        className={`
          min-h-screen
          transition-[margin] duration-200 ease-in-out
          ${sidebarOpen ? 'lg:ml-60' : ''}
        `}
      >
        {children}
      </main>
    </div>
  );
}
