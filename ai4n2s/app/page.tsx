import Link from 'next/link';

/** 首页仪表盘 — 模块入口卡片 */
export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* 标题区 */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold font-mono tracking-tight">
          AI4N2S
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-lg">
          基于 AI 的小说转剧本数据管理系统。将小说作品分析、结构化，并转换为标准剧本格式（YAML），支持导出与版本管理。
        </p>
      </div>

      {/* 模块入口卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/novels"
          className="block bg-white wireframe-border p-6 hover:wireframe-shadow transition-shadow duration-150 group"
        >
          <h2 className="text-xl font-bold font-mono group-hover:underline">
            小说管理
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            管理小说作品，上传源文件，创建和管理剧本版本
          </p>
          <span className="inline-block mt-4 text-xs font-mono text-gray-400 group-hover:text-black">
            进入 →
          </span>
        </Link>

        <Link
          href="/scripts"
          className="block bg-white wireframe-border p-6 hover:wireframe-shadow transition-shadow duration-150 group"
        >
          <h2 className="text-xl font-bold font-mono group-hover:underline">
            剧本管理
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            浏览、编辑和生成剧本，支持手动编辑与 AI 辅助生成
          </p>
          <span className="inline-block mt-4 text-xs font-mono text-gray-400 group-hover:text-black">
            进入 →
          </span>
        </Link>

        <div className="block bg-white border border-gray-200 p-6 opacity-50 cursor-not-allowed select-none">
          <h2 className="text-xl font-bold font-mono text-gray-400">
            角色管理
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            管理小说角色库，追踪角色关系和发展弧线
          </p>
          <span className="inline-block mt-4 text-xs font-mono text-gray-300">
            即将推出
          </span>
        </div>

        <div className="block bg-white border border-gray-200 p-6 opacity-50 cursor-not-allowed select-none">
          <h2 className="text-xl font-bold font-mono text-gray-400">
            导出中心
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            批量导出剧本为 YAML、PDF 等格式，支持自定义模板
          </p>
          <span className="inline-block mt-4 text-xs font-mono text-gray-300">
            即将推出
          </span>
        </div>
      </div>

      {/* 底部信息 */}
      <div className="border-t border-black pt-6 mt-12">
        <p className="text-xs text-gray-400 font-mono">
          基于 Next.js 16 + SQLite + YAML 构建
        </p>
      </div>
    </div>
  );
}
