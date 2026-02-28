/* ============================================================
   仪表盘页面 - 统计概览 + 最近活动 + 快捷操作
   风格：可爱冰雪甜品
   ============================================================ */

const { useState: useDashState, useEffect: useDashEffect } = React;

function DashboardPage() {
  const [stats, setStats] = useDashState(null);
  const [loading, setLoading] = useDashState(true);
  const [error, setError] = useDashState(null);

  useDashEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api("/stats");
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setStats(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

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
        <button onClick={loadStats} className="text-sm text-deep-purple hover:underline">
          再看看
        </button>
      </div>
    );
  }

  const { counts, recent_tracking, recent_lotteries, recent_temp_roles } = stats;

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-2 font-title">🏠 首页</h1>
      <p className="text-text-mid text-sm mb-6">🐧 欢迎回来呀～今天雪山一切正常！</p>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <CountCard
          icon="📁" label="仓库文件" value={counts.total_files}
          sub={`${counts.total_posts} 个帖子`} gradientClass="gradient-bar-1"
        />
        <CountCard
          icon="🎰" label="进行中的抽奖" value={counts.active_lotteries}
          sub="进行中" gradientClass="gradient-bar-2"
        />
        <CountCard
          icon="⏰" label="临时身份组" value={counts.active_temp_roles}
          sub="活跃中" gradientClass="gradient-bar-3"
        />
        <CountCard
          icon="🎭" label="匿名频道" value={counts.anon_channels}
          sub={`${counts.total_tracking} 条追踪记录`} gradientClass="gradient-bar-4"
        />
      </div>

      {/* 快捷操作 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-dark mb-3">快捷操作</h2>
        <div className="flex flex-wrap gap-3">
          <QuickAction icon="📁" label="管理文件" onClick={() => navigate("/files")} />
          <QuickAction icon="🎰" label="查看抽奖" onClick={() => navigate("/lottery")} />
          <QuickAction icon="🏷️" label="临时身份组" onClick={() => navigate("/roles")} />
          <QuickAction icon="🔧" label="发送公告" onClick={() => navigate("/tools")} />
          <QuickAction icon="🎭" label="匿名区查询" onClick={() => navigate("/anon")} />
        </div>
      </div>

      {/* 最近活动 */}
      <h2 className="text-lg font-semibold text-text-dark mb-3">📋 最近发生了什么</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近追踪记录 */}
        <ActivityCard title="最近文件追踪" icon="📋" emptyText="🐧 仓库里空空的呀～">
          {recent_tracking.map((r, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-dark truncate">
                  <span className="font-medium">{r.user_name}</span>
                  {" "}获取了{" "}
                  <span className="text-deep-purple">{r.post_name}</span>
                  {" / "}{r.file_name}
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  <span className="font-mono">{r.tracking_code}</span>
                  {" "}&middot;{" "}{r.version}
                </p>
              </div>
              <TimeLabel time={r.retrieved_at} />
            </ActivityRow>
          ))}
        </ActivityCard>

        {/* 最近抽奖 */}
        <ActivityCard title="最近抽奖" icon="🎰" emptyText="🐧 还没有抽奖活动哦～">
          {recent_lotteries.map((l, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-dark truncate">
                  <span className="font-medium">{l.title}</span>
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  {l.prize} &middot; {l.entry_count} 人参与 &middot;{" "}
                  <LotteryStatus status={l.status} />
                </p>
              </div>
              <TimeLabel time={l.created_at} />
            </ActivityRow>
          ))}
        </ActivityCard>

        {/* 最近临时身份组 */}
        <ActivityCard title="最近临时身份组" icon="🏷️" emptyText="🐧 目前没有临时身份组呢">
          {recent_temp_roles.map((r, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-dark truncate">
                  用户 <span className="font-mono text-xs">{r.user_id}</span>
                  {" "}&middot; 身份组 <span className="font-mono text-xs">{r.role_id}</span>
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  到期：{formatTime(r.expire_at)} &middot;{" "}
                  <TempRoleStatus status={r.status} />
                </p>
              </div>
              <TimeLabel time={r.granted_at} />
            </ActivityRow>
          ))}
        </ActivityCard>
      </div>
    </div>
  );
}

// ============ 子组件 ============

function CountCard({ icon, label, value, sub, gradientClass }) {
  return (
    <div
      className={`relative bg-white rounded-card p-5 border border-deep-purple/[0.06] transition-all hover:-translate-y-1 cursor-default ${gradientClass}`}
      style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(107,92,231,0.15)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(107,92,231,0.08)'}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <span className="text-sm text-text-mid">{label}</span>
      </div>
      <div className="text-3xl font-bold text-deep-purple">{value}</div>
      {sub && <p className="text-xs text-text-light mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 bg-white border border-deep-purple/[0.1] hover:border-deep-purple/[0.3] rounded-btn px-4 py-2.5 text-sm text-text-dark transition-all hover:-translate-y-0.5"
      style={{ boxShadow: '0 2px 8px rgba(107,92,231,0.06)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,92,231,0.12)'; e.currentTarget.style.background = 'var(--lavender)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(107,92,231,0.06)'; e.currentTarget.style.background = 'white'; }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ActivityCard({ title, icon, emptyText, children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <span>{icon}</span>
        <h3 className="font-semibold text-text-dark text-sm">{title}</h3>
      </div>
      <div>
        {items.length > 0 ? items : (
          <div className="px-5 py-8 text-center text-text-light text-sm">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ children }) {
  return (
    <div
      className="px-5 py-3 flex items-center gap-3 transition-colors"
      style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {children}
    </div>
  );
}

function TimeLabel({ time }) {
  return (
    <span className="text-xs text-text-light whitespace-nowrap shrink-0">
      {formatTime(time)}
    </span>
  );
}

function LotteryStatus({ status }) {
  const map = {
    active:    { text: "进行中", cls: "text-green-600" },
    ended:     { text: "已结束", cls: "text-text-mid" },
    cancelled: { text: "已取消", cls: "text-red-500" },
  };
  const s = map[status] || { text: status, cls: "text-text-mid" };
  return <span className={`font-medium ${s.cls}`}>{s.text}</span>;
}

function TempRoleStatus({ status }) {
  const map = {
    active:  { text: "活跃", cls: "text-green-600" },
    expired: { text: "已过期", cls: "text-text-mid" },
    removed: { text: "已移除", cls: "text-red-500" },
  };
  const s = map[status] || { text: status, cls: "text-text-mid" };
  return <span className={`font-medium ${s.cls}`}>{s.text}</span>;
}

function formatTime(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;

    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${min}`;
  } catch {
    return isoStr;
  }
}
