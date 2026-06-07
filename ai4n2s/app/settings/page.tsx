'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

const PRESETS = [
  { label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', placeholder: 'sk-proj-...' },
  { label: 'DeepSeek', provider: 'custom', baseUrl: 'https://api.deepseek.com/v1', placeholder: 'sk-...' },
  { label: '通义千问 (阿里)', provider: 'custom', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', placeholder: 'sk-...' },
  { label: '智谱 GLM', provider: 'custom', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', placeholder: 'xxx.xxxxx' },
  { label: 'Moonshot', provider: 'custom', baseUrl: 'https://api.moonshot.cn/v1', placeholder: 'sk-...' },
  { label: '本地 Ollama', provider: 'custom', baseUrl: 'http://localhost:11434/v1', placeholder: 'ollama' },
  { label: '自定义', provider: 'custom', baseUrl: '', placeholder: 'your-key' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setTestResult('');
    try {
      const res = await fetch('/api/pipeline/novels/test-llm');
      const d = await res.json();
      if (d.success) {
        setTestResult(`✅ LLM 连接成功\n模型: ${d.data.model}\nToken 用量: ${d.data.usage ? JSON.stringify(d.data.usage) : 'N/A'}\n响应预览: ${d.data.content?.slice(0, 150)}`);
      } else {
        setTestResult(`❌ ${d.error}`);
      }
    } catch (err) {
      setTestResult(`❌ 连接失败: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setProvider(d.data.provider);
          setBaseUrl(d.data.baseUrl);
          setModel(d.data.model);
          setHasKey(d.data.hasKey);
          setKeyPreview(d.data.keyPreview);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePreset = (preset: typeof PRESETS[number]) => {
    setProvider(preset.provider);
    setBaseUrl(preset.baseUrl);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, baseUrl, apiKey, model }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg('✅ 配置已保存。LLM 现在将使用真实 API。');
        setHasKey(true);
        setKeyPreview(apiKey.slice(0, 7) + '...' + apiKey.slice(-4));
        setApiKey('');
      } else {
        setMsg('❌ ' + d.error);
      }
    } catch {
      setMsg('❌ 保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-8"><p className="text-sm text-gray-400">加载中...</p></div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold font-mono tracking-tight mb-2">LLM 配置</h1>
      <p className="text-sm text-gray-500 mb-8">配置大语言模型 API。密钥保存在 <code className="bg-gray-100 px-1">data/llm-config.json</code>，不会提交到 Git。</p>

      {/* 方式一：环境变量 */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold text-sm mb-3 font-mono uppercase">方式一：环境变量（推荐）</h3>
        <p className="text-xs text-gray-500 mb-3">
          在项目根目录创建 <code className="bg-gray-100 px-1">.env.local</code> 文件，写入以下内容即可自动生效：
        </p>
        <pre className="text-xs bg-gray-50 border border-gray-300 p-3 font-mono whitespace-pre-wrap">
{`# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# 或使用其他兼容 API
# DEEPSEEK_API_KEY=sk-xxx
# DASHSCOPE_API_KEY=sk-xxx
# ZHIPU_API_KEY=xxx`}
        </pre>
        {hasKey && (
          <p className="text-xs text-green-700 mt-3">
            ✅ 已检测到 Key: {keyPreview}（来自环境变量或配置文件）
          </p>
        )}
      </Card>

      {/* 方式二：表单配置 */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 font-mono uppercase">方式二：表单配置</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-black mb-2">快速选择</label>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={`px-2 py-1 text-xs border ${baseUrl === p.baseUrl ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-black'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <Input label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          <Input label="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={PRESETS.find(p => p.baseUrl === baseUrl)?.placeholder || 'sk-...'} type="password" />
          <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />
        </div>

        {msg && <p className={`text-sm mt-4 ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-700'}`}>{msg}</p>}
        {testResult && <pre className={`text-xs mt-3 p-3 border whitespace-pre-wrap ${testResult.startsWith('✅') ? 'border-green-700 bg-green-50' : 'border-red-700 bg-red-50'}`}>{testResult}</pre>}

        <div className="flex justify-between mt-6">
          <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '🔌 测试连接'}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
