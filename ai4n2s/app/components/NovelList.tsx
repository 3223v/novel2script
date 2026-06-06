'use client';

import { useState, useEffect } from 'react';

interface SourceFile {
  name: string;
  path: string;
  type: string;
}

interface Script {
  id: string;
  version: string;
  created_at: number;
}

interface Novel {
  id: string;
  title: string;
  author: string;
  status: string;
  source_files: SourceFile[];
  scripts?: Script[];
  created_at: number;
  updated_at: number;
}

export default function NovelList() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);

  useEffect(() => {
    fetchNovels();
  }, []);

  const fetchNovels = async () => {
    try {
      const response = await fetch('/api/novels');
      const result = await response.json();
      if (result.success) {
        setNovels(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch novels:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNovel = async () => {
    if (!newTitle.trim()) return;

    try {
      const response = await fetch('/api/novels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, author: newAuthor }),
      });

      const result = await response.json();
      if (result.success) {
        setNovels([result.data, ...novels]);
        setNewTitle('');
        setNewAuthor('');
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Failed to create novel:', error);
    }
  };

  const deleteNovel = async (id: string) => {
    if (!confirm('确定要删除这部小说吗？这将同时删除所有关联的剧本和文件。')) return;

    try {
      const response = await fetch(`/api/novels/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setNovels(novels.filter((n) => n.id !== id));
        if (selectedNovel?.id === id) {
          setSelectedNovel(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete novel:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      uploading: { label: '上传中', color: 'bg-yellow-100 text-yellow-800' },
      analyzing: { label: '分析中', color: 'bg-blue-100 text-blue-800' },
      ready: { label: '就绪', color: 'bg-green-100 text-green-800' },
      error: { label: '错误', color: 'bg-red-100 text-red-800' },
    };

    const config = statusMap[status] || statusMap.uploading;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">小说列表</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 添加小说
        </button>
      </div>

      {/* 小说列表 */}
      <div className="grid gap-4">
        {novels.map((novel) => (
          <div
            key={novel.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedNovel?.id === novel.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedNovel(novel)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-lg">{novel.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  作者: {novel.author || '未知'} | 更新于: {formatDate(novel.updated_at)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(novel.status)}
                  <span className="text-xs text-gray-500">
                    {novel.source_files.length} 个源文件
                  </span>
                  {novel.scripts && novel.scripts.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {novel.scripts.length} 个剧本
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNovel(novel.id);
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {novels.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无小说，点击上方按钮添加
          </div>
        )}
      </div>

      {/* 创建小说模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加新小说</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标题 *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入小说标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作者
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入作者名称"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTitle('');
                  setNewAuthor('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={createNovel}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 小说详情面板 */}
      {selectedNovel && (
        <NovelDetail
          novel={selectedNovel}
          onClose={() => setSelectedNovel(null)}
          onUpdate={fetchNovels}
        />
      )}
    </div>
  );
}

// 小说详情组件
function NovelDetail({
  novel,
  onClose,
  onUpdate,
}: {
  novel: Novel;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptVersion, setScriptVersion] = useState('v1.0');
  const [scripts, setScripts] = useState<Script[]>(novel.scripts || []);

  useEffect(() => {
    fetchScripts();
  }, [novel.id]);

  const fetchScripts = async () => {
    try {
      const response = await fetch(`/api/novels/${novel.id}`);
      const result = await response.json();
      if (result.success) {
        setScripts(result.data.scripts || []);
      }
    } catch (error) {
      console.error('Failed to fetch scripts:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await fetch(`/api/novels/${novel.id}/files`, {
          method: 'POST',
          body: formData,
        });
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }

    setUploading(false);
    onUpdate();
  };

  const createScript = async () => {
    const scriptData = {
      script: {
        metadata: {
          title: `${novel.title} - 剧本`,
          author: novel.author,
          based_on: novel.title,
          version: scriptVersion,
          date: new Date().toISOString().split('T')[0],
          logline: '',
          genre: [],
        },
        characters: [],
        scenes: [],
      },
    };

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelId: novel.id,
          version: scriptVersion,
          data: scriptData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setScripts([result.data, ...scripts]);
        setShowScriptModal(false);
        setScriptVersion('v1.0');
      }
    } catch (error) {
      console.error('Failed to create script:', error);
    }
  };

  const deleteScript = async (scriptId: string) => {
    if (!confirm('确定要删除这个剧本吗？')) return;

    try {
      const response = await fetch(`/api/scripts/${scriptId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setScripts(scripts.filter((s) => s.id !== scriptId));
      }
    } catch (error) {
      console.error('Failed to delete script:', error);
    }
  };

  const exportYaml = (scriptId: string) => {
    window.open(`/api/scripts/${scriptId}/export-yaml`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">{novel.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* 基本信息 */}
          <div className="mb-6">
            <h4 className="font-medium mb-2">基本信息</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">作者:</span> {novel.author || '未知'}
              </div>
              <div>
                <span className="text-gray-600">状态:</span> {novel.status}
              </div>
              <div>
                <span className="text-gray-600">创建时间:</span>{' '}
                {new Date(novel.created_at).toLocaleString('zh-CN')}
              </div>
              <div>
                <span className="text-gray-600">更新时间:</span>{' '}
                {new Date(novel.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>

          {/* 源文件 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">源文件</h4>
              <label className="px-3 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 text-sm">
                {uploading ? '上传中...' : '+ 上传文件'}
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            <div className="border rounded">
              {novel.source_files.length > 0 ? (
                <ul className="divide-y">
                  {novel.source_files.map((file, idx) => (
                    <li key={idx} className="px-3 py-2 text-sm flex justify-between">
                      <span>{file.name}</span>
                      <span className="text-gray-500 text-xs">{file.type}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  暂无源文件
                </div>
              )}
            </div>
          </div>

          {/* 剧本列表 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">剧本列表</h4>
              <button
                onClick={() => setShowScriptModal(true)}
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
              >
                + 创建剧本
              </button>
            </div>
            <div className="border rounded">
              {scripts.length > 0 ? (
                <ul className="divide-y">
                  {scripts.map((script) => (
                    <li key={script.id} className="px-3 py-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{script.version}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          {new Date(script.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => exportYaml(script.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          导出 YAML
                        </button>
                        <button
                          onClick={() => deleteScript(script.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  暂无剧本
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 创建剧本模态框 */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">创建新剧本</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                版本号
              </label>
              <input
                type="text"
                value={scriptVersion}
                onChange={(e) => setScriptVersion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="例如: v1.0, 导演剪辑版"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowScriptModal(false);
                  setScriptVersion('v1.0');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={createScript}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
