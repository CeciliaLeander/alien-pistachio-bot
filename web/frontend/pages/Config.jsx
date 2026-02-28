/* ============================================================
   配置管理页面
   欢迎消息 / 规则消息 / 管理员身份组 / 匿名昵称池
   ============================================================ */

function ConfigPage() {
  const [configs, setConfigs] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("welcome");

  React.useEffect(() => { loadConfigs(); }, []);

  async function loadConfigs() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api("/config");
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setConfigs(data.configs || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(key, value) {
    try {
      const resp = await api(`/config/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "保存失败");
      await loadConfigs();
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  const TABS = [
    { key: "welcome",  label: "欢迎消息" },
    { key: "rules",    label: "规则消息" },
    { key: "admin",    label: "管理员身份组" },
    { key: "nicknames", label: "匿名昵称池" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 snowflake-spin">&#10052;&#65039;</div>
          <p className="text-text-mid text-sm">小鹅子正在翻找...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
        <p className="text-red-500 mb-3">{error}</p>
        <button onClick={loadConfigs} className="text-sm text-deep-purple hover:underline">再看看</button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-2 font-title">鹅的设置</h1>
      <p className="text-text-mid text-sm mb-6">在这里修改小鹅子的各种配置哦～改完立刻生效！</p>

      {/* 标签页 */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-4 py-2 rounded-btn text-sm font-medium transition-all"
            style={{
              background: activeTab === t.key ? 'var(--deep-purple)' : 'white',
              color: activeTab === t.key ? 'white' : 'var(--text-mid)',
              border: activeTab === t.key ? 'none' : '1px solid rgba(107,92,231,0.1)',
              boxShadow: activeTab === t.key ? '0 4px 16px rgba(107,92,231,0.3)' : '0 2px 8px rgba(107,92,231,0.06)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "welcome" && (
        <MessageEditor
          title="欢迎消息"
          description="新成员加入服务器时，小鹅子会私信发送这条消息"
          configKey="welcome_message"
          value={configs?.welcome_message?.value}
          onSave={saveConfig}
          variables={[
            { name: "{member_name}", desc: "成员用户名" },
            { name: "{member_mention}", desc: "成员@提及" },
            { name: "{rules_link}", desc: "规则链接" },
            { name: "{newbie_qa_link}", desc: "新人提问频道链接" },
            { name: "{guild_name}", desc: "服务器名称" },
          ]}
        />
      )}

      {activeTab === "rules" && (
        <MessageEditor
          title="规则消息"
          description="用户发送 !规则 时，小鹅子回复的内容"
          configKey="rules_message"
          value={configs?.rules_message?.value}
          onSave={saveConfig}
          variables={[
            { name: "{rules_link}", desc: "规则链接" },
            { name: "{newbie_qa_link}", desc: "新人提问频道链接" },
          ]}
        />
      )}

      {activeTab === "admin" && (
        <StringListEditor
          title="管理员身份组"
          description="拥有这些身份组的成员可以使用管理员指令和登录管理面板"
          configKey="admin_role_names"
          value={configs?.admin_role_names?.value || []}
          onSave={saveConfig}
          placeholder="输入身份组名称..."
          minItems={1}
          warning="修改后请确保你自己的身份组在列表中，否则会失去管理面板访问权限！"
        />
      )}

      {activeTab === "nicknames" && (
        <StringListEditor
          title="匿名昵称池"
          description="匿名区发言时随机分配的甜品代号，格式建议：emoji + 空格 + 名称"
          configKey="anon_nicknames"
          value={configs?.anon_nicknames?.value || []}
          onSave={saveConfig}
          placeholder="如：冰淇淋泡芙"
          showBulkImport={true}
        />
      )}
    </div>
  );
}

// ============ 消息编辑器组件 ============

function MessageEditor({ title, description, configKey, value, onSave, variables }) {
  const initial = value || { text: "", show_guide_image: true };
  const [text, setText] = React.useState(initial.text || "");
  const [showImage, setShowImage] = React.useState(initial.show_guide_image !== false);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await onSave(configKey, { text, show_guide_image: showImage });
    setResult(res);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">{title}</h2>
        <p className="text-xs text-text-light mt-0.5">{description}</p>
      </div>
      <div className="p-5 space-y-4">
        {/* 变量提示 */}
        {variables && variables.length > 0 && (
          <div className="rounded-2xl p-3 text-xs" style={{ background: 'var(--ice-blue)' }}>
            <p className="font-medium text-text-dark mb-1">可用变量（会自动替换）：</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {variables.map(v => (
                <span key={v.name} className="text-text-mid">
                  <code className="font-mono px-1 rounded" style={{ background: 'rgba(107,92,231,0.08)' }}>{v.name}</code>
                  {" "}{v.desc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 文本编辑 */}
        <div>
          <label className="block text-xs font-medium text-text-mid mb-1">消息内容</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 text-sm rounded-btn resize-y font-mono transition-all"
            style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none', lineHeight: '1.6' }}
            onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* 显示标注图片开关 */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={showImage}
            onChange={e => setShowImage(e.target.checked)}
            id={`${configKey}-show-image`}
            style={{ accentColor: 'var(--deep-purple)' }}
          />
          <label htmlFor={`${configKey}-show-image`} className="text-sm text-text-mid cursor-pointer">
            附带标注教程图片
          </label>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-btn transition-all disabled:opacity-50 hover:-translate-y-0.5"
            style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
          >
            {saving ? "保存中..." : "好的呀！保存～"}
          </button>
          {result && (
            <span className={`text-sm ${result.error ? "text-red-500" : "text-green-600"}`}>
              {result.error ? `${result.error}` : "保存成功！"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 字符串列表编辑器组件 ============

function StringListEditor({ title, description, configKey, value, onSave, placeholder, minItems, warning, showBulkImport }) {
  const [items, setItems] = React.useState([...(value || [])]);
  const [newItem, setNewItem] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [bulkText, setBulkText] = React.useState("");

  function handleAdd() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) return;
    setItems([...items, trimmed]);
    setNewItem("");
  }

  function handleRemove(index) {
    if (minItems && items.length <= minItems) {
      alert(`至少需要 ${minItems} 项哦～`);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  }

  function handleBulkImport() {
    const newItems = bulkText.split("\n").map(s => s.trim()).filter(s => s.length > 0);
    const unique = [...new Set([...items, ...newItems])];
    setItems(unique);
    setBulkMode(false);
    setBulkText("");
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await onSave(configKey, items);
    setResult(res);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">{title}</h2>
        <p className="text-xs text-text-light mt-0.5">{description}</p>
      </div>
      <div className="p-5 space-y-4">
        {/* 警告 */}
        {warning && (
          <div className="rounded-2xl p-3 text-sm" style={{ background: 'var(--warm-peach)', borderLeft: '4px solid #ffb366' }}>
            {warning}
          </div>
        )}

        {/* 当前列表 */}
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn text-sm border"
              style={{ background: 'rgba(107,92,231,0.06)', borderColor: 'rgba(107,92,231,0.1)' }}
            >
              {item}
              <button
                onClick={() => handleRemove(idx)}
                className="text-text-light hover:text-red-500 ml-1 text-xs"
              >&#10005;</button>
            </span>
          ))}
          {items.length === 0 && (
            <span className="text-text-light text-sm">空的呢～</span>
          )}
        </div>

        <p className="text-xs text-text-light">共 {items.length} 项</p>

        {/* 添加新项 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder={placeholder}
            className="flex-1 px-4 py-2 text-sm rounded-btn transition-all"
            style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 text-sm font-medium rounded-btn transition-all text-white"
            style={{ background: 'var(--deep-purple)' }}
          >
            添加
          </button>
          {showBulkImport && (
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className="px-4 py-2 text-sm font-medium rounded-btn transition-all"
              style={{ background: 'rgba(107,92,231,0.06)', color: 'var(--text-mid)' }}
            >
              {bulkMode ? "收起" : "批量导入"}
            </button>
          )}
        </div>

        {/* 批量导入 */}
        {bulkMode && (
          <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--snow-white)', border: '1px solid rgba(107,92,231,0.06)' }}>
            <label className="text-xs font-medium text-text-mid">每行一个昵称：</label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={6}
              placeholder={"冰淇淋泡芙\n雪域杯子蛋糕\n冰山芝士蛋糕"}
              className="w-full px-3 py-2 text-sm rounded-btn resize-y bg-white"
              style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
            />
            <button
              onClick={handleBulkImport}
              className="px-4 py-1.5 text-sm font-medium text-white rounded-btn"
              style={{ background: 'var(--deep-purple)' }}
            >
              导入
            </button>
          </div>
        )}

        {/* 保存 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-btn transition-all disabled:opacity-50 hover:-translate-y-0.5"
            style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
          >
            {saving ? "保存中..." : "好的呀！保存～"}
          </button>
          {result && (
            <span className={`text-sm ${result.error ? "text-red-500" : "text-green-600"}`}>
              {result.error ? `${result.error}` : "保存成功！"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
