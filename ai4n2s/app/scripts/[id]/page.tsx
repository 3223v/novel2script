'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { Script, ScriptYAML, ScriptCharacter, ScriptScene, SceneContent } from '@/lib/types';

type ContentType = 'action' | 'character' | 'transition' | 'shot';

/** 剧本详情编辑页 — 支持元数据 / 角色 / 场景三大模块的精细编辑 */
export default function ScriptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as string;

  const [script, setScript] = useState<Script | null>(null);
  const [content, setContent] = useState<ScriptYAML | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'metadata' | 'characters' | 'scenes'>('scenes');

  // 生成相关
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);
  const [genStrategies, setGenStrategies] = useState<Array<{ name: string; description: string }>>([]);
  const [novels, setNovels] = useState<Array<{ id: string; title: string }>>([]);
  const esRef = useRef<EventSource | null>(null);           // 持有 SSE 连接，跨弹窗生命周期
  const modalDismissedRef = useRef(false);                  // 弹窗是否已被用户关掉
  const [bgRunning, setBgRunning] = useState(false);        // 后台生成进行中

  const loadGenStrategies = () => {
    const nid = script?.novel_id;
    if (!nid) { setGenStrategies([]); return; }
    fetch(`/api/pipeline/scripts/${nid}/generate`)
      .then((r) => r.json())
      .then((data) => { if (data.success && data.data) setGenStrategies(data.data); })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/novels').then(r => r.json()).then(d => { if (d.success) setNovels(d.data); });
  }, []);

  // 编辑相关
  const [editItemIdx, setEditItemIdx] = useState<{ sceneIdx: number; itemIdx: number } | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemType, setEditItemType] = useState<ContentType>('action');

  const fetchScript = useCallback(async () => {
    try {
      const response = await fetch(`/api/scripts/${scriptId}`);
      const result = await response.json();
      if (result.success) {
        setScript(result.data);
        setContent(result.data.content);
      } else {
        setError(result.error || '剧本不存在');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scriptId]);

  useEffect(() => {
    fetchScript();
  }, [fetchScript]);

  const handleSave = async (saveContent?: ScriptYAML) => {
    const toSave = saveContent || content;
    if (!toSave) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: toSave }),
      });
      const result = await response.json();
      if (result.success) {
        fetchScript();
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (err) {
      alert(`保存失败: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── 元数据操作 ──
  const updateMeta = (key: string, value: string | string[]) => {
    if (!content) return;
    setContent({
      ...content,
      script: { ...content.script, metadata: { ...content.script.metadata, [key]: value } },
    });
  };

  // ── 角色操作 ──
  const updateCharacter = (idx: number, field: string, value: string) => {
    if (!content?.script.characters) return;
    const chars = [...content.script.characters];
    chars[idx] = { ...chars[idx], [field]: value };
    setContent({ ...content, script: { ...content.script, characters: chars } });
  };

  const addCharacter = () => {
    if (!content) return;
    const chars = content.script.characters || [];
    const newChar: ScriptCharacter = { id: `sc-${Date.now()}`, name: '新角色' };
    setContent({ ...content, script: { ...content.script, characters: [...chars, newChar] } });
  };

  const removeCharacter = (idx: number) => {
    if (!content?.script.characters) return;
    setContent({
      ...content,
      script: { ...content.script, characters: content.script.characters.filter((_, i) => i !== idx) },
    });
  };

  // ── 场景操作 ──
  const updateScene = (idx: number, field: string, value: unknown) => {
    if (!content) return;
    const scs = [...content.script.scenes];
    scs[idx] = { ...scs[idx], [field]: value };
    setContent({ ...content, script: { ...content.script, scenes: scs } });
  };

  const addScene = () => {
    if (!content) return;
    const newScene: ScriptScene = {
      id: `scene-${Date.now()}`,
      heading: '新场景',
      content: [{ type: 'action', text: '场景描述...' }],
    };
    setContent({ ...content, script: { ...content.script, scenes: [...content.script.scenes, newScene] } });
  };

  const removeScene = (idx: number) => {
    if (!content) return;
    if (!confirm('确定删除此场景？')) return;
    setContent({
      ...content,
      script: { ...content.script, scenes: content.script.scenes.filter((_, i) => i !== idx) },
    });
  };

  const moveScene = (idx: number, direction: 'up' | 'down') => {
    if (!content) return;
    const scs = [...content.script.scenes];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= scs.length) return;
    [scs[idx], scs[targetIdx]] = [scs[targetIdx], scs[idx]];
    setContent({ ...content, script: { ...content.script, scenes: scs } });
  };

  // ── 内容项操作 ──
  const addContentItem = (sceneIdx: number) => {
    if (!content) return;
    const scs = [...content.script.scenes];
    scs[sceneIdx] = {
      ...scs[sceneIdx],
      content: [...scs[sceneIdx].content, { type: 'action' as const, text: '' }],
    };
    setContent({ ...content, script: { ...content.script, scenes: scs } });
  };

  const removeContentItem = (sceneIdx: number, itemIdx: number) => {
    if (!content) return;
    const scs = [...content.script.scenes];
    scs[sceneIdx] = {
      ...scs[sceneIdx],
      content: scs[sceneIdx].content.filter((_, i) => i !== itemIdx),
    };
    setContent({ ...content, script: { ...content.script, scenes: scs } });
  };

  const startEditItem = (sceneIdx: number, itemIdx: number, item: SceneContent) => {
    setEditItemIdx({ sceneIdx, itemIdx });
    setEditItemType(item.type);

    if (item.type === 'action' || item.type === 'transition' || item.type === 'shot') {
      setEditItemText(item.text);
    } else {
      const parts = [`@${item.name}`];
      if (item.parenthetical) parts.push(`(${item.parenthetical})`);
      parts.push(`: ${item.dialogue}`);
      setEditItemText(parts.join(' '));
    }
  };

  const saveEditItem = () => {
    if (!content || !editItemIdx) return;
    const { sceneIdx, itemIdx } = editItemIdx;

    let newItem: SceneContent;
    if (editItemType === 'character') {
      const match = editItemText.match(/^@(.+?)(?:\s*\((.+?)\))?\s*:\s*([\s\S]*)$/);
      if (match) {
        newItem = { type: 'character', name: match[1].trim(), parenthetical: match[2]?.trim() || undefined, dialogue: match[3].trim() };
      } else {
        newItem = { type: 'character', name: editItemText.trim(), dialogue: '' };
      }
    } else {
      newItem = { type: editItemType, text: editItemText } as SceneContent;
    }

    const scs = [...content.script.scenes];
    const newContent = [...scs[sceneIdx].content];
    newContent[itemIdx] = newItem;
    scs[sceneIdx] = { ...scs[sceneIdx], content: newContent };

    setContent({ ...content, script: { ...content.script, scenes: scs } });
    setEditItemIdx(null);
    setEditItemText('');
  };

  // ── 生成（SSE 流式 + 后台继续）──
  const handleGenerate = (strategy: string) => {
    if (!script?.novel_id) return;

    // 清理上一次的 EventSource
    esRef.current?.close();

    modalDismissedRef.current = false;
    setGenerating(true);
    setBgRunning(false);
    setShowGenModal(true);
    setGenProgress('连接生成管线...');

    const params = new URLSearchParams({ strategy, version: script.version || 'v1.0' });
    const url = `/api/pipeline/scripts/${script.novel_id}/generate/stream?${params}`;
    const es = new EventSource(url);
    esRef.current = es;

    let finished = false;

    const cleanup = () => {
      finished = true;
      es.close();
      esRef.current = null;
      setBgRunning(false);
    };

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as { stage: string; detail: string };
      setGenProgress(`[${data.stage}] ${data.detail}`);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data) as { strategy: string; duration: number };
      cleanup();
      setGenProgress(`生成完成！（耗时 ${(data.duration / 1000).toFixed(1)} 秒）`);
      setGenerating(false);

      if (!modalDismissedRef.current) {
        // 弹窗还在：短暂展示完成后关闭
        setTimeout(() => {
          setShowGenModal(false);
          fetchScript();
        }, 1500);
      } else {
        // 弹窗已关闭（后台模式）：直接刷新数据
        fetchScript();
      }
    });

    es.addEventListener('error', (e) => {
      cleanup();
      setGenerating(false);
      try {
        const data = JSON.parse((e as MessageEvent).data) as { error: string };
        setGenProgress(`失败: ${data.error}`);
      } catch {
        setGenProgress('请求失败: 网络错误或服务器异常');
      }
    });

    // EventSource 的连接错误（区别于业务 error 事件）
    es.onerror = () => {
      if (finished) return;
      cleanup();
      setGenerating(false);
      setGenProgress('请求失败: 无法连接到生成服务');
    };
  };

  /** 关闭弹窗但保持后台生成 */
  const dismissModal = () => {
    setShowGenModal(false);
    if (generating && esRef.current) {
      // 有关联的 EventSource → 后台继续
      modalDismissedRef.current = true;
      setBgRunning(true);
    } else {
      setGenProgress('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-400 font-mono">加载剧本...</p>
      </div>
    );
  }

  if (error || !script || !content) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="border border-black p-8 text-center">
          <p className="text-gray-500 mb-4">{error || '剧本不存在'}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push('/scripts')}>
            ← 返回剧本管理
          </Button>
        </div>
      </div>
    );
  }

  const meta = content.script.metadata;
  const tabs = [
    { key: 'scenes' as const, label: `场景 (${content.script.scenes.length})` },
    { key: 'characters' as const, label: `角色 (${content.script.characters?.length || 0})` },
    { key: 'metadata' as const, label: '元数据' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 头部 */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <button onClick={() => router.push('/scripts')} className="text-xs text-gray-400 hover:text-black mb-2 block">
            ← 返回剧本管理
          </button>
          <h1 className="text-2xl font-bold font-mono tracking-tight">{meta.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            版本 {meta.version} · 原著: {meta.based_on} · {meta.date}
          </p>
          {meta.logline && <p className="text-sm text-gray-600 mt-2 italic">{meta.logline}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={generating} onClick={() => { loadGenStrategies(); setShowGenModal(true); }}>
            {generating ? '生成中...' : '🤖 生成剧本'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSave()} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (!confirm('确定要删除这个剧本吗？此操作不可撤销。')) return;
              fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' })
                .then((r) => r.json())
                .then((res) => {
                  if (res.success) router.push('/scripts');
                  else alert(`删除失败: ${res.error}`);
                })
                .catch((err) => alert(`删除失败: ${err.message}`));
            }}
          >
            删除
          </Button>
        </div>
      </div>

      {/* 后台生成通知条 */}
      {bgRunning && (
        <div className="mb-4 p-3 border border-black bg-yellow-50 flex items-center justify-between">
          <span className="text-sm font-mono">⏳ 剧本正在后台生成中，完成后将自动刷新页面...</span>
          <button
            onClick={() => {
              esRef.current?.close();
              esRef.current = null;
              setBgRunning(false);
            }}
            className="text-xs text-gray-500 hover:text-red-700 border border-gray-300 px-2 py-1"
          >
            取消
          </button>
        </div>
      )}

      {/* 标签页 */}
      <div className="flex gap-1 mb-6 border-b border-black">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm border border-black border-b-0 -mb-[1px] ${
              activeTab === tab.key ? 'bg-white font-semibold' : 'bg-gray-100 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 元数据标签页 */}
      {activeTab === 'metadata' && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="剧本标题" value={meta.title} onChange={(e) => updateMeta('title', e.target.value)} />
            <Input label="作者" value={meta.author} onChange={(e) => updateMeta('author', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-black mb-1">关联小说</label>
              <select
                value={script?.novel_id || ''}
                onChange={(e) => {
                  const newId = e.target.value || null;
                  const novel = novels.find(n => n.id === newId);
                  updateMeta('based_on', novel?.title || '');
                  fetch(`/api/scripts/${scriptId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ novelId: newId }),
                  }).then(() => fetchScript());
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">— 独立剧本（不关联小说）—</option>
                {novels.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            </div>
            <Input label="版本号" value={meta.version} onChange={(e) => updateMeta('version', e.target.value)} />
            <Input label="日期" value={meta.date} onChange={(e) => updateMeta('date', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-black mb-1">Logline</label>
              <textarea
                value={meta.logline || ''}
                onChange={(e) => updateMeta('logline', e.target.value)}
                className="w-full h-20 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">类型 (逗号分隔)</label>
              <input
                value={(meta.genre || []).join(', ')}
                onChange={(e) => updateMeta('genre', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </Card>
      )}

      {/* 角色标签页 */}
      {activeTab === 'characters' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm font-mono uppercase">剧本角色</h3>
            <Button variant="secondary" size="sm" onClick={addCharacter}>+ 添加角色</Button>
          </div>
          {(content.script.characters || []).map((char, idx) => (
            <Card key={char.id || idx} className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label="姓名" value={char.name} onChange={(e) => updateCharacter(idx, 'name', e.target.value)} />
                <Input label="描述" value={char.description || ''} onChange={(e) => updateCharacter(idx, 'description', e.target.value)} />
              </div>
              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="sm" onClick={() => removeCharacter(idx)}>删除</Button>
              </div>
            </Card>
          ))}
          {(!content.script.characters || content.script.characters.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-8">暂无角色，点击上方按钮添加</p>
          )}
        </div>
      )}

      {/* 场景标签页 */}
      {activeTab === 'scenes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm font-mono uppercase">场景序列</h3>
            <Button variant="secondary" size="sm" onClick={addScene}>+ 添加场景</Button>
          </div>

          {content.script.scenes.map((scene, si) => (
            <Card key={scene.id || si} className="p-4">
              {/* 场景头部 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex flex-col gap-1 mr-2">
                  <button onClick={() => moveScene(si, 'up')} disabled={si === 0} className="text-xs border border-black px-1 hover:bg-black hover:text-white disabled:opacity-20">↑</button>
                  <button onClick={() => moveScene(si, 'down')} disabled={si === content.script.scenes.length - 1} className="text-xs border border-black px-1 hover:bg-black hover:text-white disabled:opacity-20">↓</button>
                </div>
                <span className="font-mono text-xs text-gray-400 w-8">#{si + 1}</span>
                <input
                  value={scene.heading}
                  onChange={(e) => updateScene(si, 'heading', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm font-semibold border border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="场景标题，如：内. 办公室 - 日"
                />
                <Input
                  label=""
                  value={scene.notes || ''}
                  onChange={(e) => updateScene(si, 'notes', e.target.value)}
                  placeholder="备注..."
                  className="!w-32 text-xs"
                />
                <Button variant="ghost" size="sm" onClick={() => removeScene(si)}>✕</Button>
              </div>

              {/* 内容项列表 */}
              <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                {scene.content.map((item, ci) => (
                  <div key={ci} className="group flex items-start gap-2">
                    {/* 类型标记 */}
                    <span className={`text-xs font-mono mt-1 w-12 shrink-0 text-right ${
                      item.type === 'character' ? 'text-black font-bold' :
                      item.type === 'transition' ? 'text-gray-400 uppercase' :
                      item.type === 'shot' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {item.type === 'character' ? '对话' :
                       item.type === 'transition' ? '转场' :
                       item.type === 'shot' ? '镜头' : '动作'}
                    </span>

                    {/* 内容显示 */}
                    <div className="flex-1 min-w-0">
                      {item.type === 'action' && <p className="text-sm text-gray-800">{item.text || '(空)'}</p>}
                      {item.type === 'transition' && <p className="text-sm text-gray-500 uppercase text-right">{item.text || '(空)'}</p>}
                      {item.type === 'shot' && <p className="text-sm text-gray-500 font-semibold">[{item.text || '镜头'}]</p>}
                      {item.type === 'character' && (
                        <p className="text-sm pl-2">
                          <span className="font-semibold uppercase">{item.name}</span>
                          {item.parenthetical && <span className="text-gray-500 text-xs"> ({item.parenthetical})</span>}
                          <span className="mx-1">:</span>
                          <span>{item.dialogue || '(空)'}</span>
                        </p>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                      <button onClick={() => startEditItem(si, ci, item)} className="text-xs text-gray-400 hover:text-black">编辑</button>
                      <button onClick={() => removeContentItem(si, ci)} className="text-xs text-gray-400 hover:text-red-700">✕</button>
                    </div>
                  </div>
                ))}

                {/* 添加内容项 */}
                <div className="flex gap-1 pt-1">
                  {(['action', 'character', 'transition', 'shot'] as ContentType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        const newItem: SceneContent = t === 'character'
                          ? { type: 'character', name: '', dialogue: '' }
                          : { type: t, text: '' };
                        const scs = [...content.script.scenes];
                        scs[si] = { ...scs[si], content: [...scs[si].content, newItem] };
                        setContent({ ...content, script: { ...content.script, scenes: scs } });
                        startEditItem(si, scs[si].content.length - 1, newItem);
                      }}
                      className="text-xs text-gray-400 hover:text-black border border-gray-300 px-1.5 py-0.5 hover:border-black"
                    >
                      + {t === 'action' ? '动作' : t === 'character' ? '对话' : t === 'transition' ? '转场' : '镜头'}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {content.script.scenes.length === 0 && (
            <div className="text-center py-16 border border-black">
              <p className="text-gray-400 text-sm mb-4">暂无场景</p>
              <Button variant="secondary" size="sm" onClick={addScene}>+ 添加第一个场景</Button>
            </div>
          )}
        </div>
      )}

      {/* 内容项编辑弹窗 */}
      {editItemIdx && (
        <Modal
          open={!!editItemIdx}
          onClose={() => setEditItemIdx(null)}
          title={`编辑内容项 — ${editItemType === 'character' ? '角色对话' : editItemType === 'action' ? '动作描述' : editItemType === 'transition' ? '转场' : '镜头'}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['action', 'character', 'transition', 'shot'] as ContentType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEditItemType(t)}
                  className={`px-3 py-1 text-xs border ${
                    editItemType === t ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-black'
                  }`}
                >
                  {t === 'action' ? '动作' : t === 'character' ? '对话' : t === 'transition' ? '转场' : '镜头'}
                </button>
              ))}
            </div>

            {editItemType === 'character' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">格式: @角色名 (情绪): 台词内容</p>
                <textarea
                  value={editItemText}
                  onChange={(e) => setEditItemText(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-sm font-mono bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="@张三 (愤怒): 你怎么能这样！"
                  autoFocus
                />
              </div>
            ) : (
              <textarea
                value={editItemText}
                onChange={(e) => setEditItemText(e.target.value)}
                className="w-full h-32 px-3 py-2 text-sm bg-white border border-black focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="输入文本内容..."
                autoFocus
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditItemIdx(null)}>取消</Button>
              <Button variant="primary" size="sm" onClick={saveEditItem}>确认</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 剧本生成弹窗 */}
      <Modal open={showGenModal} onClose={dismissModal} title="生成剧本内容" size="md">
        <div className="space-y-4">
          {genProgress && (
            <div className={`p-3 border ${genProgress.includes('失败') ? 'border-red-700 bg-red-50' : genProgress.includes('刷新') || genProgress.includes('完成') ? 'border-green-700 bg-green-50' : 'border-black bg-gray-50'}`}>
              <p className="text-sm font-mono">{genProgress}</p>
              {generating && (
                <p className="text-xs text-gray-400 mt-2">关闭弹窗后生成将在后台继续，完成后自动刷新</p>
              )}
            </div>
          )}
          {!generating && !genProgress.includes('刷新') && !genProgress.includes('完成') && !genProgress.includes('失败') && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">选择生成策略:</p>
              {genStrategies.length > 0 ? (
                genStrategies.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleGenerate(s.name)}
                    className="w-full text-left p-3 border border-black hover:bg-gray-50 text-sm"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-gray-400 ml-2">— {s.description}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400">加载策略中...</p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={dismissModal}>
              {generating ? '最小化（后台继续）' : '关闭'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
