/* ============================================================
   匿名区管理页面
   频道列表 + 消息记录表格 + 身份查询 + 搜索筛选
   风格：可爱冰雪甜品
   ============================================================ */

function AnonPage() {
  const [channels, setChannels] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [selectedChannel, setSelectedChannel] = React.useState(null); // null = 全部
  const [loading, setLoading] = React.useState(true);
  const [msgsLoading, setMsgsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // 展开的消息（查看身份详情）
  const [expandedId, setExpandedId] = React.useState(null);
  const [identityData, setIdentityData] = React.useState(null);
  const [identityLoading, setIdentityLoading] = React.useState(false);

  // 搜索/筛选
  const [searchText, setSearchText] = React.useState("");
  const [limit, setLimit] = React.useState(50);

  // 加载频道列表
  React.useEffect(() => {
    loadChannels();
  }, []);

  // 频道或 limit 变化时加载消息
  React.useEffect(() => {
    loadMessages();
  }, [selectedChannel, limit]);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api("/anon/channels");
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setChannels(data.channels || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    setMsgsLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (selectedChannel) params.set("channel_id", String(selectedChannel));
      const resp = await api(`/anon/messages?${params}`);
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setMsgsLoading(false);
    }
  }

  async function handleRevealIdentity(botMessageId) {
    if (expandedId === botMessageId) {
      setExpandedId(null);
      setIdentityData(null);
      return;
    }
    setExpandedId(botMessageId);
    setIdentityLoading(true);
    setIdentityData(null);
    try {
      const resp = await api(`/anon/identity/${botMessageId}`);
      if (!resp.ok) throw new Error("查询失败");
      const data = await resp.json();
      setIdentityData(data);
    } catch (e) {
      setIdentityData({ error: e.message });
    } finally {
      setIdentityLoading(false);
    }
  }

  // 前端搜索过滤
  const filteredMessages = React.useMemo(() => {
    if (!searchText.trim()) return messages;
    const q = searchText.toLowerCase();
    return messages.filter(m =>
      (m.nickname || "").toLowerCase().includes(q) ||
      (m.content || "").toLowerCase().includes(q)
    );
  }, [messages, searchText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 snowflake-spin">❄️</div>
          <p className="text-text-mid text-sm">🐧 小鹅子正在翻找...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
        <p className="text-red-500 mb-3">❌ {error}</p>
        <button onClick={loadChannels} className="text-sm text-deep-purple hover:underline">再看看</button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-6 font-title">🎭 匿名区管理</h1>

      {/* 频道选择 + 搜索栏 */}
      <div className="bg-white rounded-card border border-deep-purple/[0.06] p-4 mb-4" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
        <div className="flex flex-wrap items-center gap-4">
          {/* 频道筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-mid shrink-0">频道：</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedChannel(null)}
                className="px-3 py-1.5 rounded-btn text-xs font-medium transition-all"
                style={{
                  background: selectedChannel === null ? 'var(--deep-purple)' : 'rgba(107,92,231,0.06)',
                  color: selectedChannel === null ? 'white' : 'var(--text-mid)',
                }}
              >
                全部
              </button>
              {channels.map(ch => (
                <button
                  key={ch.channel_id}
                  onClick={() => setSelectedChannel(ch.channel_id)}
                  className="px-3 py-1.5 rounded-btn text-xs font-medium font-mono transition-all"
                  style={{
                    background: selectedChannel === ch.channel_id ? 'var(--deep-purple)' : 'rgba(107,92,231,0.06)',
                    color: selectedChannel === ch.channel_id ? 'white' : 'var(--text-mid)',
                  }}
                >
                  #{ch.channel_id}
                </button>
              ))}
            </div>
          </div>

          {/* 搜索 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="🔍 鹅帮你找找..."
              className="w-full px-4 py-2 text-sm rounded-btn transition-all"
              style={{
                border: '1.5px solid rgba(107,92,231,0.15)',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* 条数 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-mid shrink-0">显示：</span>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-btn bg-white"
              style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
            >
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
            </select>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
          <h2 className="font-semibold text-text-dark text-sm">
            💬 悄悄话记录
            {msgsLoading && <span className="text-text-light font-normal ml-2">加载中...</span>}
          </h2>
          <span className="text-xs text-text-light">{filteredMessages.length} 条</span>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-light text-sm">
            {msgsLoading ? (
              <span><span className="snowflake-spin inline-block">❄️</span> 加载中...</span>
            ) : (searchText ? "没有匹配的消息" : "🤫 🐧 这里很安静呀...")}
          </div>
        ) : (
          <div>
            {filteredMessages.map(msg => (
              <AnonMessageRow
                key={msg.id}
                msg={msg}
                isExpanded={expandedId === msg.bot_message_id}
                identityData={expandedId === msg.bot_message_id ? identityData : null}
                identityLoading={expandedId === msg.bot_message_id && identityLoading}
                onToggle={() => handleRevealIdentity(msg.bot_message_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 子组件 ============

function AnonMessageRow({ msg, isExpanded, identityData, identityLoading, onToggle }) {
  const contentPreview = (msg.content || "").length > 80
    ? msg.content.slice(0, 80) + "..."
    : (msg.content || "");

  return (
    <div>
      {/* 消息行 */}
      <div
        className="px-5 py-3 flex items-start gap-4 cursor-pointer transition-colors"
        style={{
          background: isExpanded ? 'var(--lavender)' : undefined,
          borderBottom: '1px solid rgba(107,92,231,0.06)',
        }}
        onClick={onToggle}
        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--lavender)'; }}
        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}
      >
        {/* 昵称 */}
        <div className="w-40 shrink-0">
          <span className="text-sm font-medium text-text-dark">{msg.nickname}</span>
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-mid break-all">{contentPreview || <span className="text-text-light italic">（空消息）</span>}</p>
        </div>

        {/* 频道 + 时间 */}
        <div className="shrink-0 text-right">
          <div className="text-xs text-text-light font-mono">#{msg.channel_id}</div>
          <div className="text-xs text-text-light mt-0.5">{formatTime(msg.sent_at)}</div>
        </div>

        {/* 展开指示 */}
        <div className="shrink-0 pt-0.5">
          <svg
            className={`w-4 h-4 text-text-light transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="px-5 py-4" style={{ background: 'var(--snow-white)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 完整内容 */}
            <div>
              <h4 className="text-xs font-semibold text-text-mid uppercase mb-2">完整内容</h4>
              <div className="bg-white rounded-2xl p-3 text-sm text-text-dark border border-deep-purple/[0.06] whitespace-pre-wrap break-all min-h-[60px]">
                {msg.content || <span className="text-text-light italic">（空消息）</span>}
              </div>
            </div>

            {/* 身份信息 */}
            <div>
              <h4 className="text-xs font-semibold text-text-mid uppercase mb-2">真实身份</h4>
              {identityLoading ? (
                <div className="bg-white rounded-2xl p-3 border border-deep-purple/[0.06] text-sm text-text-light">
                  <span className="snowflake-spin inline-block mr-1">❄️</span> 查询中...
                </div>
              ) : identityData?.error ? (
                <div className="rounded-2xl p-3 text-sm" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
                  ❌ {identityData.error}
                </div>
              ) : identityData ? (
                <div className="bg-white rounded-2xl p-3 border border-deep-purple/[0.06] space-y-2">
                  <AnonDetailRow label="用户 ID" value={identityData.user_id} mono />
                  <AnonDetailRow label="匿名昵称" value={identityData.nickname} />
                  <AnonDetailRow label="频道 ID" value={identityData.channel_id} mono />
                  <AnonDetailRow label="消息 ID" value={identityData.bot_message_id} mono />
                  <AnonDetailRow label="发送时间" value={identityData.sent_at} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnonDetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-mid shrink-0 w-20">{label}</span>
      <span className={`text-text-dark break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value != null ? String(value) : "-"}
      </span>
    </div>
  );
}
