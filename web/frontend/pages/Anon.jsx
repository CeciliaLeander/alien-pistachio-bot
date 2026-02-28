/* ============================================================
   匿名区管理页面
   频道列表 + 消息记录表格 + 身份查询 + 搜索筛选
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
        <div className="text-4xl animate-bounce">🐧</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <button onClick={loadChannels} className="text-sm text-red-500 hover:text-red-700 underline">重试</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">匿名区管理</h1>

      {/* 频道选择 + 搜索栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 频道筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">频道：</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedChannel(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedChannel === null
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                全部
              </button>
              {channels.map(ch => (
                <button
                  key={ch.channel_id}
                  onClick={() => setSelectedChannel(ch.channel_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-colors ${
                    selectedChannel === ch.channel_id
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
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
              placeholder="搜索昵称或内容..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          {/* 条数 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">显示：</span>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 bg-white"
            >
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
            </select>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">
            消息记录
            {msgsLoading && <span className="text-gray-400 font-normal ml-2">加载中...</span>}
          </h2>
          <span className="text-xs text-gray-400">{filteredMessages.length} 条</span>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-300 text-sm">
            {msgsLoading ? "加载中..." : (searchText ? "没有匹配的消息" : "暂无匿名消息记录")}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
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
        className={`px-5 py-3 flex items-start gap-4 cursor-pointer transition-colors ${
          isExpanded ? "bg-blue-50/50" : "hover:bg-gray-50"
        }`}
        onClick={onToggle}
      >
        {/* 昵称 */}
        <div className="w-40 shrink-0">
          <span className="text-sm font-medium text-gray-800">{msg.nickname}</span>
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 break-all">{contentPreview || <span className="text-gray-300 italic">（空消息）</span>}</p>
        </div>

        {/* 频道 + 时间 */}
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400 font-mono">#{msg.channel_id}</div>
          <div className="text-xs text-gray-400 mt-0.5">{formatTime(msg.sent_at)}</div>
        </div>

        {/* 展开指示 */}
        <div className="shrink-0 pt-0.5">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="px-5 py-4 bg-blue-50/30 border-t border-blue-100/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 完整内容 */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">完整内容</h4>
              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-100 whitespace-pre-wrap break-all min-h-[60px]">
                {msg.content || <span className="text-gray-300 italic">（空消息）</span>}
              </div>
            </div>

            {/* 身份信息 */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">真实身份</h4>
              {identityLoading ? (
                <div className="bg-white rounded-lg p-3 border border-gray-100 text-sm text-gray-400">
                  查询中...
                </div>
              ) : identityData?.error ? (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100 text-sm text-red-600">
                  {identityData.error}
                </div>
              ) : identityData ? (
                <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
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
      <span className="text-gray-500 shrink-0 w-20">{label}</span>
      <span className={`text-gray-800 break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value != null ? String(value) : "-"}
      </span>
    </div>
  );
}
