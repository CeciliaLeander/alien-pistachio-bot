/* ============================================================
   抽奖管理页面
   标签页切换 + 抽奖卡片 + 操作按钮 + 参与者列表
   风格：可爱冰雪甜品
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
    if (!confirm("🐧 现在就开奖吗？让鹅来抽！")) return;
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
    if (!confirm("🐧 确定要取消这个抽奖吗？")) return;
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
    { key: "active",    label: "🎲 进行中" },
    { key: "ended",     label: "🎊 已开奖" },
    { key: "cancelled", label: "❌ 已取消" },
  ];

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-6 font-title">🎰 抽奖管理</h1>

      {/* 标签页 */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedId(null); setDetail(null); setDrawResult(null); }}
            className="px-4 py-2 rounded-btn text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? 'var(--deep-purple)' : 'white',
              color: tab === t.key ? 'white' : 'var(--text-mid)',
              border: tab === t.key ? 'none' : '1px solid rgba(107,92,231,0.1)',
              boxShadow: tab === t.key ? '0 4px 16px rgba(107,92,231,0.3)' : '0 2px 8px rgba(107,92,231,0.06)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 开奖结果弹出 */}
      {drawResult && (
        <div className="mb-4 rounded-2xl p-4" style={{ background: 'var(--warm-peach)', borderLeft: '4px solid #ffb366' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text-dark">
                🎊 开奖完成 - {drawResult.title}
              </p>
              <p className="text-sm text-text-mid mt-1">
                奖品：{drawResult.prize} &middot; 参与人数：{drawResult.total_entries} &middot;
                中奖 {drawResult.winners?.length || 0} 人
              </p>
              {drawResult.winners?.length > 0 && (
                <p className="text-sm mt-1 font-mono text-deep-purple">
                  中奖者：{drawResult.winners.join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setDrawResult(null)}
              className="text-text-light hover:text-text-dark text-lg"
            >&times;</button>
          </div>
        </div>
      )}

      {/* 内容区 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-4xl mb-3 snowflake-spin">❄️</div>
            <p className="text-text-mid text-sm">🐧 鹅在努力加载中...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
          <p className="text-red-500 mb-3">❌ {error}</p>
          <button onClick={loadLotteries} className="text-sm text-deep-purple hover:underline">再看看</button>
        </div>
      ) : lotteries.length === 0 ? (
        <div className="bg-white rounded-card border border-deep-purple/[0.06] p-12 text-center" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
          <div className="text-5xl mb-3">🎪</div>
          <p className="text-text-light">
            {tab === "active" ? "🐧 还没有抽奖活动哦～" : tab === "ended" ? "🐧 还没有已开奖的活动呢" : "🐧 没有已取消的抽奖"}
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
    active:    { text: "进行中", bg: "rgba(102,204,153,0.15)", textColor: "#22c55e", dot: "#22c55e" },
    ended:     { text: "已结束", bg: "rgba(107,92,231,0.08)",  textColor: "var(--text-mid)", dot: "var(--text-light)" },
    cancelled: { text: "已取消", bg: "rgba(255,68,102,0.1)",   textColor: "#ff4466", dot: "#ff4466" },
  };
  const sc = statusConfig[lottery.status] || statusConfig.ended;

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden transition-all hover:-translate-y-0.5" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      {/* 卡片头部 */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors"
        onClick={onExpand}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        {/* 状态点 */}
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sc.dot }}></div>

        {/* 标题和信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-text-dark truncate">{lottery.title}</h3>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: sc.bg, color: sc.textColor }}
            >
              {sc.text}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-light">
            <span>奖品：<span className="text-text-mid">{lottery.prize}</span></span>
            <span>中奖名额：<span className="text-text-mid">{lottery.winner_count}</span></span>
            <span>参与人数：<span className="text-text-mid">{lottery.entry_count}</span></span>
            {lottery.end_time && (
              <span>截止：<span className="text-text-mid">{formatTime(lottery.end_time)}</span></span>
            )}
            <span>创建：<span className="text-text-mid">{formatTime(lottery.created_at)}</span></span>
          </div>
        </div>

        {/* 操作按钮 */}
        {lottery.status === "active" && (
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={onDraw}
              disabled={actionLoading}
              className="px-3 py-1.5 text-white text-xs font-medium rounded-btn transition-all disabled:opacity-50 hover:-translate-y-0.5"
              style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
            >
              {actionLoading ? "处理中..." : "开奖啦！"}
            </button>
            <button
              onClick={onCancel}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-btn transition-all disabled:opacity-50"
              style={{ background: 'rgba(107,92,231,0.06)', color: 'var(--text-mid)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-pink)'; e.currentTarget.style.color = '#ff4466'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(107,92,231,0.06)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
            >
              算了算了
            </button>
          </div>
        )}

        {/* 展开箭头 */}
        <svg
          className={`w-4 h-4 text-text-light shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(107,92,231,0.06)', background: 'var(--snow-white)' }}>
          {detailLoading ? (
            <div className="text-center text-text-light text-sm py-4">
              <span className="snowflake-spin inline-block mr-1">❄️</span> 加载中...
            </div>
          ) : !detail ? (
            <div className="text-center text-text-light text-sm py-4">加载详情失败</div>
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
                <h4 className="text-sm font-semibold text-text-dark mb-2">
                  参与者 ({detail.entries.length})
                </h4>
                {detail.entries.length === 0 ? (
                  <p className="text-sm text-text-light">🐧 还没有人参加呢</p>
                ) : (
                  <div className="bg-white rounded-2xl border border-deep-purple/[0.06] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'rgba(107,92,231,0.04)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
                          <th className="text-left px-4 py-2 font-semibold text-text-dark w-12">#</th>
                          <th className="text-left px-4 py-2 font-semibold text-text-dark">用户 ID</th>
                          <th className="text-left px-4 py-2 font-semibold text-text-dark">参与时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.entries.map((entry, idx) => (
                          <tr
                            key={idx}
                            className="transition-colors"
                            style={{
                              background: idx % 2 === 0 ? 'var(--snow-white)' : 'white',
                              borderBottom: '1px solid rgba(107,92,231,0.06)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
                            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--snow-white)' : 'white'}
                          >
                            <td className="px-4 py-2 text-text-light text-xs">{idx + 1}</td>
                            <td className="px-4 py-2 font-mono text-xs text-text-dark">{entry.user_id}</td>
                            <td className="px-4 py-2 text-xs text-text-light">{formatTime(entry.entered_at)}</td>
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
    <div className="bg-white rounded-2xl border border-deep-purple/[0.06] px-3 py-2">
      <div className="text-xs text-text-light mb-0.5">{label}</div>
      <div className={`text-sm text-text-dark truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value != null ? String(value) : "-"}
      </div>
    </div>
  );
}
