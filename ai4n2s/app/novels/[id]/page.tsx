'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { NormalizedNovel, Character, Location, Chapter, Scene } from '@/lib/types';

type EditorMode = 'form' | 'json';

/** 小说结构化数据编辑器 — 表单模式 + JSON 模式双视图 */
export default function NovelEditorPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = params.id as string;

  const [data, setData] = useState<NormalizedNovel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metadata' | 'characters' | 'locations' | 'chapters' | 'scenes'>('metadata');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/novels/${novelId}/normalized`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setJsonText(JSON.stringify(result.data, null, 2));
      } else {
        setError(result.error || '数据加载失败');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (saveData?: NormalizedNovel) => {
    const toSave = saveData || data;
    if (!toSave) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/novels/${novelId}/normalized`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setJsonText(JSON.stringify(result.data, null, 2));
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (err) {
      alert(`保存失败: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleJsonSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.metadata || !parsed.characters || !parsed.scenes) {
        setJsonError('JSON 缺少必要字段: metadata, characters, scenes');
        return;
      }
      setJsonError(null);
      handleSave(parsed);
    } catch {
      setJsonError('JSON 格式错误，请检查语法');
    }
  };

  // ── 表单编辑辅助 ──

  const updateMetadata = (key: string, value: unknown) => {
    if (!data) return;
    setData({ ...data, metadata: { ...data.metadata, [key]: value } });
  };

  const updateCharacter = (idx: number, field: string, value: string) => {
    if (!data) return;
    const chars = [...data.characters];
    chars[idx] = { ...chars[idx], [field]: value };
    setData({ ...data, characters: chars });
  };

  const addCharacter = () => {
    if (!data) return;
    const newChar: Character = {
      id: `char-${Date.now()}`,
      name: '新角色',
      role: '配角',
    };
    setData({ ...data, characters: [...data.characters, newChar] });
  };

  const removeCharacter = (idx: number) => {
    if (!data) return;
    setData({ ...data, characters: data.characters.filter((_, i) => i !== idx) });
  };

  const updateLocation = (idx: number, field: string, value: string) => {
    if (!data) return;
    const locs = [...data.locations];
    locs[idx] = { ...locs[idx], [field]: value };
    setData({ ...data, locations: locs });
  };

  const addLocation = () => {
    if (!data) return;
    setData({ ...data, locations: [...data.locations, { id: `loc-${Date.now()}`, name: '新地点' }] });
  };

  const removeLocation = (idx: number) => {
    if (!data) return;
    setData({ ...data, locations: data.locations.filter((_, i) => i !== idx) });
  };

  const updateChapter = (idx: number, field: string, value: string) => {
    if (!data) return;
    const chs = [...data.chapters];
    chs[idx] = { ...chs[idx], [field]: field === 'index' ? parseInt(value) || 0 : value };
    setData({ ...data, chapters: chs });
  };

  const updateScene = (idx: number, field: string, value: string) => {
    if (!data) return;
    const scs = [...data.scenes];
    scs[idx] = { ...scs[idx], [field]: value };
    setData({ ...data, scenes: scs });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-400 font-mono">加载结构化数据...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="border border-black p-8 text-center">
          <p className="text-gray-500 mb-4">{error || '数据不存在'}</p>
          <p className="text-xs text-gray-400 mb-4">请先在小说管理中上传文件并执行「结构化分析」。</p>
          <Button variant="secondary" size="sm" onClick={() => router.push('/novels')}>
            ← 返回小说管理
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'metadata', label: '基本信息' },
    { key: 'characters', label: `角色 (${data.characters.length})` },
    { key: 'locations', label: `地点 (${data.locations.length})` },
    { key: 'chapters', label: `章节 (${data.chapters.length})` },
    { key: 'scenes', label: `场景 (${data.scenes.length})` },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 头部 */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <button onClick={() => router.push('/novels')} className="text-xs text-gray-400 hover:text-black mb-2 block">
            ← 返回小说管理
          </button>
          <h1 className="text-2xl font-bold font-mono tracking-tight">
            {data.metadata.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            结构化数据编辑器 · {data.metadata.word_count.toLocaleString()} 字
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === 'form' ? 'json' : 'form')}
          >
            {mode === 'form' ? '切换到 JSON' : '切换到表单'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSave()} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* JSON 编辑模式 */}
      {mode === 'json' && (
        <div className="space-y-4">
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
            className="w-full h-[60vh] px-4 py-3 text-sm font-mono bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
            spellCheck={false}
          />
          {jsonError && <p className="text-sm text-red-700">{jsonError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setJsonText(JSON.stringify(data, null, 2)); setJsonError(null); }}>
              重置
            </Button>
            <Button variant="primary" size="sm" onClick={handleJsonSave}>
              保存 JSON
            </Button>
          </div>
        </div>
      )}

      {/* 表单编辑模式 */}
      {mode === 'form' && (
        <>
          {/* 标签页 */}
          <div className="flex gap-1 mb-6 border-b border-black">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm border border-black border-b-0 -mb-[1px] ${
                  activeTab === tab.key
                    ? 'bg-white font-semibold'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 元数据 */}
          {activeTab === 'metadata' && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-4 font-mono uppercase">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="标题" value={data.metadata.title} onChange={(e) => updateMetadata('title', e.target.value)} />
                <Input label="作者" value={data.metadata.author} onChange={(e) => updateMetadata('author', e.target.value)} />
                <Input label="字数" value={String(data.metadata.word_count)} onChange={(e) => updateMetadata('word_count', parseInt(e.target.value) || 0)} type="number" />
                <Input label="分析日期" value={new Date(data.metadata.analysis_date).toISOString().slice(0, 10)} onChange={(e) => updateMetadata('analysis_date', new Date(e.target.value).getTime())} type="date" />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-black mb-1">情节摘要</label>
                <textarea
                  value={data.plot_summary}
                  onChange={(e) => setData({ ...data, plot_summary: e.target.value })}
                  className="w-full h-32 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
                />
              </div>
            </Card>
          )}

          {/* 角色 */}
          {activeTab === 'characters' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm font-mono uppercase">角色列表</h3>
                <Button variant="secondary" size="sm" onClick={addCharacter}>+ 添加角色</Button>
              </div>
              {data.characters.map((char, idx) => (
                <Card key={char.id || idx} className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="姓名" value={char.name} onChange={(e) => updateCharacter(idx, 'name', e.target.value)} />
                    <Input label="角色定位" value={char.role || ''} onChange={(e) => updateCharacter(idx, 'role', e.target.value)} />
                    <Input label="描述" value={char.description || ''} onChange={(e) => updateCharacter(idx, 'description', e.target.value)} />
                    <Input label="性格" value={char.personality || ''} onChange={(e) => updateCharacter(idx, 'personality', e.target.value)} />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" onClick={() => removeCharacter(idx)}>删除</Button>
                  </div>
                </Card>
              ))}
              {data.characters.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无角色</p>
              )}
            </div>
          )}

          {/* 地点 */}
          {activeTab === 'locations' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm font-mono uppercase">地点列表</h3>
                <Button variant="secondary" size="sm" onClick={addLocation}>+ 添加地点</Button>
              </div>
              {data.locations.map((loc, idx) => (
                <Card key={loc.id || idx} className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="名称" value={loc.name} onChange={(e) => updateLocation(idx, 'name', e.target.value)} />
                    <Input label="描述" value={loc.description || ''} onChange={(e) => updateLocation(idx, 'description', e.target.value)} />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" onClick={() => removeLocation(idx)}>删除</Button>
                  </div>
                </Card>
              ))}
              {data.locations.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无地点</p>
              )}
            </div>
          )}

          {/* 章节 */}
          {activeTab === 'chapters' && (
            <div className="space-y-3">
              {data.chapters.map((ch, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="序号" value={String(ch.index)} onChange={(e) => updateChapter(idx, 'index', e.target.value)} type="number" />
                    <Input label="标题" value={ch.title} onChange={(e) => updateChapter(idx, 'title', e.target.value)} />
                  </div>
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-black mb-1">摘要</label>
                    <textarea
                      value={ch.summary}
                      onChange={(e) => updateChapter(idx, 'summary', e.target.value)}
                      className="w-full h-20 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* 场景 */}
          {activeTab === 'scenes' && (
            <div className="space-y-3">
              {data.scenes.map((scene, idx) => (
                <Card key={idx} className="p-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Input label="所属章节" value={String(scene.chapter_index)} onChange={(e) => updateScene(idx, 'chapter_index', e.target.value)} type="number" />
                    <Input label="标题" value={scene.heading} onChange={(e) => updateScene(idx, 'heading', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">角色列表 (逗号分隔)</label>
                    <input
                      value={(scene.characters || []).join(', ')}
                      onChange={(e) => {
                        const chars = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setData({ ...data, scenes: data.scenes.map((s, i) => i === idx ? { ...s, characters: chars } : s) });
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-black mb-1">原文片段</label>
                    <textarea
                      value={scene.raw_text || ''}
                      onChange={(e) => updateScene(idx, 'raw_text', e.target.value)}
                      className="w-full h-24 px-3 py-2 text-sm font-mono bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
