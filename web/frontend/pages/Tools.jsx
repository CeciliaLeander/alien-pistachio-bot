/* ============================================================
   工具页面
   公告发送 + 操作日志
   ============================================================ */

function ToolsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">工具</h1>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-700 text-sm">发送公告</h2>
      </div>
      <div className="p-5 space-y-4">
        {/* 频道 ID */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">频道 ID</label>
          <input
            type="text"
            value={channelId}
            onChange={e => setChannelId(e.target.value)}
            placeholder="输入 Discord 频道 ID"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 font-mono"
          />
        </div>

        {/* 模式切换 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">消息类型</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === "text"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              纯文本
            </button>
            <button
              onClick={() => setMode("embed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === "embed"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Embed
            </button>
          </div>
        </div>

        {/* Embed 字段 */}
        {mode === "embed" && (
          <div className="space-y-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Embed 标题</label>
              <input
                type="text"
                value={embedTitle}
                onChange={e => setEmbedTitle(e.target.value)}
                placeholder="标题"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Embed 描述</label>
              <textarea
                value={embedDesc}
                onChange={e => setEmbedDesc(e.target.value)}
                placeholder="描述内容（支持 Markdown）"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 bg-white resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={embedColor}
                  onChange={e => setEmbedColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                />
                <span className="text-xs text-gray-400 font-mono">{embedColor}</span>
              </div>
            </div>
          </div>
        )}

        {/* 文本内容 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {mode === "text" ? "公告内容" : "附加文本（可选）"}
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="输入消息内容..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 resize-none"
          />
        </div>

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {sending ? "发送中..." : "发送公告"}
        </button>

        {/* 结果 */}
        {result && (
          <div className={`rounded-lg p-3 text-sm ${
            result.error
              ? "bg-red-50 border border-red-200 text-red-600"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}>
            {result.error
              ? result.error
              : `发送成功 (消息 ID: ${result.message_id || "-"})`}
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
    pending:    { text: "等待中", bg: "bg-yellow-100", color: "text-yellow-700" },
    processing: { text: "执行中", bg: "bg-blue-100",   color: "text-blue-700" },
    done:       { text: "完成",   bg: "bg-green-100",  color: "text-green-700" },
    failed:     { text: "失败",   bg: "bg-red-100",    color: "text-red-600" },
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 text-sm">操作日志</h2>
        <button
          onClick={loadTasks}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-300 text-sm">暂无操作记录</div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
          {tasks.map(task => {
            const sc = statusConfig[task.status] || statusConfig.pending;
            return (
              <div key={task.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {typeLabels[task.task_type] || task.task_type}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                      {sc.text}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(task.created_at)}</span>
                </div>
                {task.result && (
                  <p className="text-xs text-gray-500 truncate">
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
