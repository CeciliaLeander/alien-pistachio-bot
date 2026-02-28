/* ============================================================
   仪表盘页面 - 统计概览 + 最近活动 + 快捷操作
   ============================================================ */

// api() 和 navigate() 定义在 app.jsx 中，由于 Babel standalone 按顺序编译，
// 此文件在 app.jsx 之前加载，所以这些函数需要在 app.jsx 中先于此组件被定义。
// 但因为 Babel standalone 对外部 src 脚本是异步 fetch 后统一编译的，
// 实际运行时所有脚本在同一作用域，因此可以互相引用全局函数。

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
          <div className="text-4xl mb-3 animate-bounce">🐧</div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <button onClick={loadStats} className="text-sm text-red-500 hover:text-red-700 underline">
          重试
        </button>
      </div>
    );
  }

  const { counts, recent_tracking, recent_lotteries, recent_temp_roles } = stats;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <CountCard
          icon="📁" label="文件总数" value={counts.total_files}
          sub={`${counts.total_posts} 个帖子`} color="blue"
        />
        <CountCard
          icon="🎰" label="活跃抽奖" value={counts.active_lotteries}
          sub="进行中" color="amber"
        />
        <CountCard
          icon="🏷️" label="临时身份组" value={counts.active_temp_roles}
          sub="活跃中" color="purple"
        />
        <CountCard
          icon="🎭" label="匿名频道" value={counts.anon_channels}
          sub={`${counts.total_tracking} 条追踪记录`} color="emerald"
        />
      </div>

      {/* 快捷操作 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">快捷操作</h2>
        <div className="flex flex-wrap gap-3">
          <QuickAction icon="📁" label="管理文件" onClick={() => navigate("/files")} />
          <QuickAction icon="🎰" label="查看抽奖" onClick={() => navigate("/lottery")} />
          <QuickAction icon="🏷️" label="临时身份组" onClick={() => navigate("/roles")} />
          <QuickAction icon="🔧" label="发送公告" onClick={() => navigate("/tools")} />
          <QuickAction icon="🎭" label="匿名区查询" onClick={() => navigate("/anon")} />
        </div>
      </div>

      {/* 最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近追踪记录 */}
        <ActivityCard title="最近文件追踪" icon="📋" emptyText="暂无追踪记录">
          {recent_tracking.map((r, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  <span className="font-medium">{r.user_name}</span>
                  {" "}获取了{" "}
                  <span className="text-blue-600">{r.post_name}</span>
                  {" / "}{r.file_name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono">{r.tracking_code}</span>
                  {" "}&middot;{" "}{r.version}
                </p>
              </div>
              <TimeLabel time={r.retrieved_at} />
            </ActivityRow>
          ))}
        </ActivityCard>

        {/* 最近抽奖 */}
        <ActivityCard title="最近抽奖" icon="🎰" emptyText="暂无抽奖">
          {recent_lotteries.map((l, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  <span className="font-medium">{l.title}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {l.prize} &middot; {l.entry_count} 人参与 &middot;{" "}
                  <LotteryStatus status={l.status} />
                </p>
              </div>
              <TimeLabel time={l.created_at} />
            </ActivityRow>
          ))}
        </ActivityCard>

        {/* 最近临时身份组 */}
        <ActivityCard title="最近临时身份组" icon="🏷️" emptyText="暂无临时身份组">
          {recent_temp_roles.map((r, i) => (
            <ActivityRow key={i}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  用户 <span className="font-mono text-xs">{r.user_id}</span>
                  {" "}&middot; 身份组 <span className="font-mono text-xs">{r.role_id}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
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

function CountCard({ icon, label, value, sub, color }) {
  const colorMap = {
    blue:    "bg-blue-50 text-blue-600",
    amber:   "bg-amber-50 text-amber-600",
    purple:  "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  const iconBg = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${iconBg}`}>
          {icon}
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-gray-700 transition-colors shadow-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ActivityCard({ title, icon, emptyText, children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {items.length > 0 ? items : (
          <div className="px-5 py-8 text-center text-gray-300 text-sm">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ children }) {
  return (
    <div className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
      {children}
    </div>
  );
}

function TimeLabel({ time }) {
  return (
    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
      {formatTime(time)}
    </span>
  );
}

function LotteryStatus({ status }) {
  const map = {
    active:    { text: "进行中", cls: "text-green-600" },
    ended:     { text: "已结束", cls: "text-gray-500" },
    cancelled: { text: "已取消", cls: "text-red-500" },
  };
  const s = map[status] || { text: status, cls: "text-gray-500" };
  return <span className={`font-medium ${s.cls}`}>{s.text}</span>;
}

function TempRoleStatus({ status }) {
  const map = {
    active:  { text: "活跃", cls: "text-green-600" },
    expired: { text: "已过期", cls: "text-gray-500" },
    removed: { text: "已移除", cls: "text-red-500" },
  };
  const s = map[status] || { text: status, cls: "text-gray-500" };
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
