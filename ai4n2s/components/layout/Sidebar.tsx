'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/' },
  { label: '小说管理', href: '/novels' },
  { label: '剧本管理', href: '/scripts' },
  { label: '角色管理', href: '/characters', disabled: true },
  { label: '场景编辑', href: '/scenes', disabled: true },
  { label: '导出中心', href: '/export', disabled: true },
  { label: '设置', href: '/settings' },
];

interface ScriptNavItem {
  id: string;
  label: string;
  version: string;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  // 剧本子导航
  const [scriptItems, setScriptItems] = useState<ScriptNavItem[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);

  // 小说子导航
  const [novelItems, setNovelItems] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingNovels, setLoadingNovels] = useState(false);

  const isScriptsRoute = pathname.startsWith('/scripts');
  const isNovelsRoute = pathname.startsWith('/novels');
  const activeNovelId = pathname.match(/^\/novels\/([^/]+)/)?.[1] || null;

  useEffect(() => {
    if (isScriptsRoute) {
      setLoadingScripts(true);
      fetch('/api/scripts')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setScriptItems(data.data.map((s: { id: string; novel_title?: string; version: string }) => ({
              id: s.id,
              label: s.novel_title || '独立剧本',
              version: s.version,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingScripts(false));
    }

    if (isNovelsRoute) {
      setLoadingNovels(true);
      fetch('/api/novels')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setNovelItems(data.data.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingNovels(false));
    }
  }, [isScriptsRoute, isNovelsRoute, pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isScriptActive = (scriptId: string) => pathname === `/scripts/${scriptId}`;

  return (
    <>
      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 侧栏面板 */}
      <aside
        className={`
          fixed top-0 left-0 z-40
          h-full w-60
          bg-white border-r border-black
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 品牌标识 — 与阅读页顶栏同高 */}
        <div className="border-b border-black px-4 flex items-center" style={{ height: 56 }}>
          <div className="flex-1">
            <Link href="/" className="block" onClick={onClose}>
              <h1 className="text-lg font-bold font-mono tracking-tight leading-tight">
                AI4N2S
              </h1>
              <p className="text-xs text-gray-500 leading-tight">
                小说转剧本系统
              </p>
            </Link>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 border border-black flex items-center justify-center text-xs hover:bg-black hover:text-white shrink-0"
          >
            ✕
          </button>
        </div>

        {/* 主导航 */}
        <nav className="py-2">
          <p className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">
            导航
          </p>
          <ul>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  {item.disabled ? (
                    <span
                      className="block px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed select-none"
                      title="即将推出"
                    >
                      {item.label}
                      <span className="ml-2 text-xs text-gray-300">—</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`
                        block px-4 py-2.5 text-sm
                        transition-colors duration-100
                        border-l-2
                        ${
                          active
                            ? 'border-black bg-gray-100 font-semibold text-black'
                            : 'border-transparent hover:bg-gray-50 hover:border-gray-300 text-gray-700'
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 小说子导航 — 仅在小说路由下显示 */}
        {isNovelsRoute && (
          <div className="flex-1 overflow-y-auto border-t border-gray-200">
            <div className="px-4 py-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">小说列表</p>
            </div>
            {loadingNovels ? (
              <p className="px-4 py-2 text-xs text-gray-300">加载中...</p>
            ) : novelItems.length > 0 ? (
              <ul>
                {novelItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/novels/${item.id}/read`}
                      onClick={onClose}
                      className={`block px-4 py-2 text-xs transition-colors duration-100 border-l-2 ${activeNovelId === item.id ? 'border-black bg-gray-100 font-semibold text-black' : 'border-transparent hover:bg-gray-50 hover:border-gray-300 text-gray-600'}`}
                    >
                      <span className="truncate block">{item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-2 text-xs text-gray-300">暂无小说</p>
            )}
          </div>
        )}

        {/* 剧本子导航 — 仅在剧本路由下显示 */}
        {isScriptsRoute && (
          <div className="flex-1 overflow-y-auto border-t border-gray-200">
            <div className="px-4 py-2 flex justify-between items-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">剧本列表</p>
              <Link href="/scripts" onClick={onClose} className="text-xs text-gray-400 hover:text-black">+ 新建</Link>
            </div>
            {loadingScripts ? (
              <p className="px-4 py-2 text-xs text-gray-300">加载中...</p>
            ) : scriptItems.length > 0 ? (
              <ul>
                {scriptItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/scripts/${item.id}`}
                      onClick={onClose}
                      className={`block px-4 py-2 text-xs transition-colors duration-100 border-l-2 ${isScriptActive(item.id) ? 'border-black bg-gray-100 font-semibold text-black' : 'border-transparent hover:bg-gray-50 hover:border-gray-300 text-gray-600'}`}
                    >
                      <span className="truncate block">{item.label}</span>
                      <span className="text-gray-400">{item.version}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-2 text-xs text-gray-300">暂无剧本，请从小说详情页创建。</p>
            )}
          </div>
        )}

        {/* 无子导航时占位 */}
        {!isScriptsRoute && !isNovelsRoute && <div className="flex-1" />}

        {/* 底部版本号 */}
        <div className="border-t border-black px-4 py-3">
          <p className="text-xs text-gray-400 font-mono">
            v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
