/* ============================================================
   抽奖管理页面
   标签页切换 + 抽奖卡片 + 操作按钮 + 参与者列表
   ============================================================ */

function LotteryPage() {
  const [tab, setTab] = React.useState("active");          // active / ended / cancelled
  const [lotteries, setLotteries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // 展开的抽奖详情
  const [expandedId, setExpandedId] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // 操作状态
  const [actionLoading, setActionLoading] = React.useState(null); // lottery_id being acted on
  const [drawResult, setDrawResult] = React.useState(null);

  React.useEffect(() => { loadLotteries(); }, [tab]);

  async function loadLotteries() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api(`/lottery?status=${tab}`);
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setLotteries(data.lotteries || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const resp = await api(`/lottery/${id}`);
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDraw(id) {
    if (!confirm("确定要手动开奖吗？此操作不可撤销。")) return;
    setActionLoading(id);
    setDrawResult(null);
    try {
      const resp = await api(`/lottery/${id}/draw`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "开奖失败");
      setDrawResult(data);
      await loadLotteries();
    } catch (e) {
      alert("开奖失败: " + e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(id) {
    if (!confirm("确定要取消此抽奖吗？此操作不可撤销。")) return;
    setActionLoading(id);
    try {
      const resp = await api(`/lottery/${id}/cancel`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "取消失败");
      await loadLotteries();
    } catch (e) {
      alert("取消失败: " + e.message);
    } finally {
      setActionLoading(null);
    }
  }

  const TABS = [
    { key: "active",    label: "进行中", color: "green" },
    { key: "ended",     label: "已结束", color: "gray" },
    { key: "cancelled", label: "已取消", color: "red" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">抽奖管理</h1>

      {/* 标签页 */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedId(null); setDetail(null); setDrawResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white shadow-sm text-gray-800 border border-gray-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 开奖结果弹出 */}
      {drawResult && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-800">
                开奖完成 - {drawResult.title}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                奖品：{drawResult.prize} &middot; 参与人数：{drawResult.total_entries} &middot;
                中奖 {drawResult.winners?.length || 0} 人
              </p>
              {drawResult.winners?.length > 0 && (
                <p className="text-sm text-amber-600 mt-1 font-mono">
                  中奖者：{drawResult.winners.join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setDrawResult(null)}
              className="text-amber-400 hover:text-amber-600 text-lg"
            >&times;</button>
          </div>
        </div>
      )}

      {/* 内容区 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-4xl animate-bounce">🐧</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-3">{error}</p>
          <button onClick={loadLotteries} className="text-sm text-red-500 hover:text-red-700 underline">重试</button>
        </div>
      ) : lotteries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">🎰</div>
          <p className="text-gray-400">
            {tab === "active" ? "没有进行中的抽奖" : tab === "ended" ? "没有已结束的抽奖" : "没有已取消的抽奖"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lotteries.map(lottery => (
            <LotteryCard
              key={lottery.id}
              lottery={lottery}
              isExpanded={expandedId === lottery.id}
              detail={expandedId === lottery.id ? detail : null}
              detailLoading={expandedId === lottery.id && detailLoading}
              actionLoading={actionLoading === lottery.id}
              onExpand={() => handleExpand(lottery.id)}
              onDraw={() => handleDraw(lottery.id)}
              onCancel={() => handleCancel(lottery.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 子组件 ============

function LotteryCard({ lottery, isExpanded, detail, detailLoading, actionLoading, onExpand, onDraw, onCancel }) {
  const statusConfig = {
    active:    { text: "进行中", bg: "bg-green-100", textColor: "text-green-700", dot: "bg-green-500" },
    ended:     { text: "已结束", bg: "bg-gray-100",  textColor: "text-gray-600",  dot: "bg-gray-400" },
    cancelled: { text: "已取消", bg: "bg-red-100",   textColor: "text-red-600",   dot: "bg-red-400" },
  };
  const sc = statusConfig[lottery.status] || statusConfig.ended;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 卡片头部 */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onExpand}
      >
        {/* 状态点 */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`}></div>

        {/* 标题和信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-gray-800 truncate">{lottery.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.textColor}`}>
              {sc.text}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>奖品：<span className="text-gray-600">{lottery.prize}</span></span>
            <span>中奖名额：<span className="text-gray-600">{lottery.winner_count}</span></span>
            <span>参与人数：<span className="text-gray-600">{lottery.entry_count}</span></span>
            {lottery.end_time && (
              <span>截止：<span className="text-gray-600">{formatTime(lottery.end_time)}</span></span>
            )}
            <span>创建：<span className="text-gray-600">{formatTime(lottery.created_at)}</span></span>
          </div>
        </div>

        {/* 操作按钮 */}
        {lottery.status === "active" && (
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={onDraw}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? "处理中..." : "手动开奖"}
            </button>
            <button
              onClick={onCancel}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        )}

        {/* 展开箭头 */}
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
          {detailLoading ? (
            <div className="text-center text-gray-400 text-sm py-4">加载中...</div>
          ) : !detail ? (
            <div className="text-center text-gray-400 text-sm py-4">加载详情失败</div>
          ) : (
            <div>
              {/* 抽奖详细信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <LotteryInfoItem label="抽奖 ID" value={`#${detail.lottery.id}`} />
                <LotteryInfoItem label="频道 ID" value={detail.lottery.channel_id} mono />
                <LotteryInfoItem label="创建者 ID" value={detail.lottery.created_by} mono />
                <LotteryInfoItem label="状态" value={sc.text} />
                {detail.lottery.ended_at && (
                  <LotteryInfoItem label="结束时间" value={formatTime(detail.lottery.ended_at)} />
                )}
                {detail.lottery.required_role_id && (
                  <LotteryInfoItem label="限制身份组" value={detail.lottery.required_role_id} mono />
                )}
              </div>

              {/* 参与者列表 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">
                  参与者 ({detail.entries.length})
                </h4>
                {detail.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无参与者</p>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="text-left px-4 py-2 font-medium text-gray-500 w-12">#</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">用户 ID</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">参与时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detail.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-700">{entry.user_id}</td>
                            <td className="px-4 py-2 text-xs text-gray-400">{formatTime(entry.entered_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LotteryInfoItem({ label, value, mono }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-sm text-gray-700 truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value != null ? String(value) : "-"}
      </div>
    </div>
  );
}
