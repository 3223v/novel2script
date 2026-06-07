'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { NormalizedNovel, Character, NovelChapter } from '@/lib/types';

type EditorMode = 'form' | 'json';

/** 小说结构化数据编辑器 — 以章节为核心的表单 + JSON 双模式 */
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

  // 表单模式展开状态
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/novels/${novelId}/normalized`);
      const result = await res.json();
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (saveData?: NormalizedNovel) => {
    const toSave = saveData || data;
    if (!toSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/normalized`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      const result = await res.json();
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
      if (!parsed.metadata || !parsed.chapters) {
        setJsonError('JSON 缺少必要字段: metadata, chapters');
        return;
      }
      setJsonError(null);
      handleSave(parsed);
    } catch {
      setJsonError('JSON 格式错误，请检查语法');
    }
  };

  // ── 元数据更新 ──
  const updateMeta = (key: string, value: unknown) => {
    if (!data) return;
    setData({ ...data, metadata: { ...data.metadata, [key]: value } });
  };

  // ── 角色操作 ──
  const updateCharacter = (idx: number, field: string, value: string) => {
    if (!data) return;
    const chars = [...data.characters];
    chars[idx] = { ...chars[idx], [field]: value };
    setData({ ...data, characters: chars });
  };
  const addCharacter = () => {
    if (!data) return;
    setData({ ...data, characters: [...data.characters, { id: `char-${Date.now()}`, name: '新角色', role: '配角' }] });
  };
  const removeCharacter = (idx: number) => {
    if (!data) return;
    setData({ ...data, characters: data.characters.filter((_, i) => i !== idx) });
  };

  // ── 章节操作 ──
  const updateChapter = (idx: number, field: string, value: unknown) => {
    if (!data) return;
    const chs = [...data.chapters];
    chs[idx] = { ...chs[idx], [field]: value };
    setData({ ...data, chapters: chs });
  };
  const addChapter = () => {
    if (!data) return;
    const ch: NovelChapter = { index: data.chapters.length, title: '新章节', summary: '', content: '', characters: [], locations: [] };
    setData({ ...data, chapters: [...data.chapters, ch] });
  };
  const removeChapter = (idx: number) => {
    if (!data) return;
    if (!confirm('确定删除此章节？')) return;
    setData({ ...data, chapters: data.chapters.filter((_, i) => i !== idx) });
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 头部 */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <button onClick={() => router.push('/novels')} className="text-xs text-gray-400 hover:text-black mb-2 block">
            ← 返回小说管理
          </button>
          <h1 className="text-2xl font-bold font-mono tracking-tight">{data.metadata.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            结构化数据编辑器 · {data.metadata.word_count.toLocaleString()} 字 · {data.chapters.length} 章
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setMode(mode === 'form' ? 'json' : 'form'); setJsonError(null); }}>
            {mode === 'form' ? 'JSON 编辑' : '表单编辑'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSave()} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* JSON 模式 */}
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
            <Button variant="secondary" size="sm" onClick={() => { setJsonText(JSON.stringify(data, null, 2)); setJsonError(null); }}>重置</Button>
            <Button variant="primary" size="sm" onClick={handleJsonSave}>保存 JSON</Button>
          </div>
        </div>
      )}

      {/* 表单模式 */}
      {mode === 'form' && (
        <div className="space-y-8">
          {/* 元数据 */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4 font-mono uppercase tracking-wider">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="标题" value={data.metadata.title} onChange={(e) => updateMeta('title', e.target.value)} />
              <Input label="作者" value={data.metadata.author} onChange={(e) => updateMeta('author', e.target.value)} />
              <Input label="字数" value={String(data.metadata.word_count)} onChange={(e) => updateMeta('word_count', parseInt(e.target.value) || 0)} type="number" />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-black mb-1">情节摘要</label>
              <textarea
                value={data.plot_summary}
                onChange={(e) => setData({ ...data, plot_summary: e.target.value })}
                className="w-full h-24 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
              />
            </div>
          </Card>

          {/* 角色 */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm font-mono uppercase tracking-wider">角色 ({data.characters.length})</h3>
              <Button variant="secondary" size="sm" onClick={addCharacter}>+ 添加</Button>
            </div>
            {data.characters.length === 0 && <p className="text-sm text-gray-400 py-2">暂无角色</p>}
            <div className="space-y-2">
              {data.characters.map((char, idx) => (
                <div key={char.id || idx} className="grid grid-cols-4 gap-2 items-center border-b border-gray-200 pb-2">
                  <Input label="" value={char.name} onChange={(e) => updateCharacter(idx, 'name', e.target.value)} placeholder="姓名" />
                  <Input label="" value={char.role || ''} onChange={(e) => updateCharacter(idx, 'role', e.target.value)} placeholder="定位" />
                  <Input label="" value={char.description || ''} onChange={(e) => updateCharacter(idx, 'description', e.target.value)} placeholder="描述" />
                  <Button variant="ghost" size="sm" onClick={() => removeCharacter(idx)}>删除</Button>
                </div>
              ))}
            </div>
          </Card>

          {/* 章节 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm font-mono uppercase tracking-wider">章节 ({data.chapters.length})</h3>
              <Button variant="secondary" size="sm" onClick={addChapter}>+ 添加章节</Button>
            </div>

            <div className="space-y-3">
              {data.chapters.map((ch, ci) => (
                <Card key={ci} className="p-3">
                  {/* 章节头部 */}
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setExpandedChapter(expandedChapter === ci ? null : ci)}
                  >
                    <span className="font-mono text-xs text-gray-400 w-8">#{ci + 1}</span>
                    <span className="font-semibold text-sm flex-1 truncate">{ch.title || '(无标题)'}</span>
                    <span className="text-xs text-gray-400">{ch.content?.length?.toLocaleString() || 0} 字</span>
                    <span className="text-xs text-gray-400">{expandedChapter === ci ? '▲' : '▼'}</span>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeChapter(ci); }}>删除</Button>
                  </div>

                  {/* 展开的章节详情 */}
                  {expandedChapter === ci && (
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="标题" value={ch.title} onChange={(e) => updateChapter(ci, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">摘要</label>
                        <textarea
                          value={ch.summary}
                          onChange={(e) => updateChapter(ci, 'summary', e.target.value)}
                          className="w-full h-16 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">角色（逗号分隔）</label>
                        <input
                          value={(ch.characters || []).join(', ')}
                          onChange={(e) => updateChapter(ci, 'characters', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">地点（逗号分隔）</label>
                        <input
                          value={(ch.locations || []).join(', ')}
                          onChange={(e) => updateChapter(ci, 'locations', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                          className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">正文</label>
                        <textarea
                          value={ch.content}
                          onChange={(e) => updateChapter(ci, 'content', e.target.value)}
                          className="w-full h-48 px-3 py-2 text-sm font-mono bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
                        />
                      </div>

                    </div>
                  )}
                </Card>
              ))}
              {data.chapters.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">暂无章节，点击上方按钮添加</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
