/* ============================================================
   工具页面
   公告发送 + 操作日志
   风格：可爱冰雪甜品
   ============================================================ */

function ToolsPage() {
  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-6 font-title">🔧 鹅的工具箱</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnnouncementTool />
        <TaskLog />
      </div>
    </div>
  );
}

// ============ 公告发送 ============

function AnnouncementTool() {
  const [channelId, setChannelId] = React.useState("");
  const [mode, setMode] = React.useState("text");   // text / embed
  const [content, setContent] = React.useState("");
  const [embedTitle, setEmbedTitle] = React.useState("");
  const [embedDesc, setEmbedDesc] = React.useState("");
  const [embedColor, setEmbedColor] = React.useState("#88ccff");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function handleSend() {
    if (!channelId.trim()) {
      setResult({ error: "请输入频道 ID" });
      return;
    }

    const payload = { channel_id: parseInt(channelId) };

    if (mode === "text") {
      if (!content.trim()) {
        setResult({ error: "请输入公告内容" });
        return;
      }
      payload.content = content;
    } else {
      if (!embedTitle.trim() && !embedDesc.trim()) {
        setResult({ error: "请填写 Embed 标题或描述" });
        return;
      }
      payload.embed = {
        title: embedTitle,
        description: embedDesc,
        color: parseInt(embedColor.replace("#", ""), 16) || 0x88ccff,
      };
      if (content.trim()) payload.content = content;
    }

    setSending(true);
    setResult(null);
    try {
      const resp = await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          task_type: "send_announcement",
          payload,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "创建任务失败");

      // 轮询任务状态
      const taskResult = await pollTask(data.task_id);
      setResult(taskResult);

      if (taskResult && !taskResult.error) {
        setContent("");
        setEmbedTitle("");
        setEmbedDesc("");
      }
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">📢 代发公告</h2>
      </div>
      <div className="p-5 space-y-4">
        {/* 频道 ID */}
        <div>
          <label className="block text-xs font-medium text-text-mid mb-1">频道 ID</label>
          <input
            type="text"
            value={channelId}
            onChange={e => setChannelId(e.target.value)}
            placeholder="在这里输入呀～"
            className="w-full px-4 py-2.5 text-sm rounded-btn font-mono transition-all"
            style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* 模式切换 */}
        <div>
          <label className="block text-xs font-medium text-text-mid mb-1">消息类型</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("text")}
              className="px-3 py-1.5 rounded-btn text-xs font-medium transition-all"
              style={{
                background: mode === "text" ? 'var(--deep-purple)' : 'rgba(107,92,231,0.06)',
                color: mode === "text" ? 'white' : 'var(--text-mid)',
              }}
            >
              纯文本
            </button>
            <button
              onClick={() => setMode("embed")}
              className="px-3 py-1.5 rounded-btn text-xs font-medium transition-all"
              style={{
                background: mode === "embed" ? 'var(--deep-purple)' : 'rgba(107,92,231,0.06)',
                color: mode === "embed" ? 'white' : 'var(--text-mid)',
              }}
            >
              Embed
            </button>
          </div>
        </div>

        {/* Embed 字段 */}
        {mode === "embed" && (
          <div className="space-y-3 rounded-2xl p-3 border" style={{ background: 'var(--snow-white)', borderColor: 'rgba(107,92,231,0.06)' }}>
            <div>
              <label className="block text-xs font-medium text-text-mid mb-1">Embed 标题</label>
              <input
                type="text"
                value={embedTitle}
                onChange={e => setEmbedTitle(e.target.value)}
                placeholder="在这里输入呀～"
                className="w-full px-4 py-2.5 text-sm rounded-btn bg-white transition-all"
                style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-mid mb-1">Embed 描述</label>
              <textarea
                value={embedDesc}
                onChange={e => setEmbedDesc(e.target.value)}
                placeholder="在这里输入呀～（支持 Markdown）"
                rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-btn bg-white resize-none transition-all"
                style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-mid mb-1">颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={embedColor}
                  onChange={e => setEmbedColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer"
                  style={{ border: '1.5px solid rgba(107,92,231,0.15)' }}
                />
                <span className="text-xs text-text-light font-mono">{embedColor}</span>
              </div>
            </div>
          </div>
        )}

        {/* 文本内容 */}
        <div>
          <label className="block text-xs font-medium text-text-mid mb-1">
            {mode === "text" ? "公告内容" : "附加文本（可选）"}
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="在这里输入呀～"
            rows={4}
            className="w-full px-4 py-2.5 text-sm rounded-btn resize-none transition-all"
            style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-2.5 text-white text-sm font-semibold rounded-btn transition-all disabled:opacity-50 hover:-translate-y-0.5"
          style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
          onMouseEnter={e => { if (!sending) e.currentTarget.style.boxShadow = '0 6px 20px rgba(107,92,231,0.4)'; }}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,92,231,0.3)'}
        >
          {sending ? "发送中..." : "交给鹅！"}
        </button>

        {/* 结果 */}
        {result && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={result.error ? {
              background: 'var(--soft-pink)',
              borderLeft: '4px solid #ff6680',
            } : {
              background: 'var(--mint-green)',
              borderLeft: '4px solid #66cc99',
            }}
          >
            {result.error
              ? `❌ ${result.error}`
              : `✅ 🐧 公告发出去啦～ (消息 ID: ${result.message_id || "-"})`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 操作日志 ============

function TaskLog() {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const resp = await api("/tasks/recent");
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setTasks(data.tasks || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig = {
    pending:    { text: "等待中", bg: "var(--warm-peach)", color: "#e6940a" },
    processing: { text: "执行中", bg: "var(--ice-blue)",   color: "var(--deep-purple)" },
    done:       { text: "完成",   bg: "var(--mint-green)",  color: "#22c55e" },
    failed:     { text: "失败",   bg: "var(--soft-pink)",    color: "#ff4466" },
  };

  const typeLabels = {
    draw_lottery:      "手动开奖",
    cancel_lottery:    "取消抽奖",
    remove_temp_role:  "移除身份组",
    grant_temp_role:   "发放身份组",
    bulk_delete:       "批量删除",
    send_announcement: "发送公告",
  };

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">📋 操作日志</h2>
        <button
          onClick={loadTasks}
          className="text-xs font-medium px-3 py-1 rounded-btn transition-all"
          style={{ color: 'var(--deep-purple)', background: 'rgba(107,92,231,0.06)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(107,92,231,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(107,92,231,0.06)'}
        >
          再看看
        </button>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-text-light text-sm">
          <span className="snowflake-spin inline-block mr-1">❄️</span> 加载中...
        </div>
      ) : tasks.length === 0 ? (
        <div className="px-5 py-8 text-center text-text-light text-sm">
          <div className="text-4xl mb-2">📋</div>
          🐧 暂无操作记录呢
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto">
          {tasks.map(task => {
            const sc = statusConfig[task.status] || statusConfig.pending;
            return (
              <div
                key={task.id}
                className="px-5 py-3 transition-colors"
                style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-dark">
                      {typeLabels[task.task_type] || task.task_type}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-lg text-xs font-medium"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.text}
                    </span>
                  </div>
                  <span className="text-xs text-text-light">{formatTime(task.created_at)}</span>
                </div>
                {task.result && (
                  <p className="text-xs text-text-mid truncate">
                    {typeof task.result === "object"
                      ? (task.result.error || JSON.stringify(task.result))
                      : String(task.result)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ 任务轮询辅助 ============

async function pollTask(taskId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const resp = await api(`/tasks/${taskId}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === "done") return data.result || { ok: true };
      if (data.status === "failed") return { error: data.result?.error || "任务执行失败" };
    } catch {
      continue;
    }
  }
  return { error: "任务超时，请在操作日志中查看结果" };
}
