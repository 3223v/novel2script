import NovelList from './components/NovelList';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI4N2S</h1>
              <p className="text-sm text-gray-600">小说转剧本系统 - 数据管理</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                v1.0
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-600 mb-1">总小说数</div>
            <div className="text-2xl font-bold text-gray-900">--</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-600 mb-1">总剧本数</div>
            <div className="text-2xl font-bold text-gray-900">--</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-600 mb-1">存储路径</div>
            <div className="text-sm font-mono text-gray-700 truncate">data/storage/</div>
          </div>
        </div>

        {/* Novel List */}
        <div className="bg-white rounded-lg border p-6">
          <NovelList />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          基于 Next.js 16 + SQLite + YAML 构建 | 数据格式设计详见 docs/2.md
        </div>
      </footer>
    </div>
  );
}
