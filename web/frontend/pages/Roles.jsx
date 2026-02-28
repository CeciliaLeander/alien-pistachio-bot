/* ============================================================
   身份组管理页面
   临时身份组列表（含批量移除） + 订阅面板列表
   风格：可爱冰雪甜品
   ============================================================ */

function RolesPage() {
  const [tempRoles, setTempRoles] = React.useState([]);
  const [panels, setPanels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // 批量选择
  const [selected, setSelected] = React.useState(new Set());
  const [removing, setRemoving] = React.useState(false);

  React.useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [rolesResp, panelsResp] = await Promise.all([
        api("/temp-roles"),
        api("/subscribe-panels"),
      ]);
      if (!rolesResp.ok || !panelsResp.ok) throw new Error("加载失败");
      const rolesData = await rolesResp.json();
      const panelsData = await panelsResp.json();
      setTempRoles(rolesData.temp_roles || []);
      setPanels(panelsData.panels || []);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === tempRoles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tempRoles.map(r => r.id)));
    }
  }

  async function handleRemoveSingle(id) {
    if (!confirm("🐧 确定要提前拿走这个身份组吗？")) return;
    setRemoving(true);
    try {
      const resp = await api(`/temp-roles/${id}`, { method: "DELETE" });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "移除失败");
      }
      await loadAll();
    } catch (e) {
      alert("移除失败: " + e.message);
    } finally {
      setRemoving(false);
    }
  }

  async function handleBatchRemove() {
    if (selected.size === 0) return;
    if (!confirm(`🐧 确定要批量拿走 ${selected.size} 个临时身份组吗？`)) return;
    setRemoving(true);
    let failed = 0;
    for (const id of selected) {
      try {
        const resp = await api(`/temp-roles/${id}`, { method: "DELETE" });
        if (!resp.ok) failed++;
      } catch {
        failed++;
      }
    }
    if (failed > 0) alert(`${failed} 个移除失败`);
    await loadAll();
    setRemoving(false);
  }

  // 解析 role_ids JSON 字符串
  function parseRoleIds(roleIdsStr) {
    try {
      const arr = JSON.parse(roleIdsStr);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
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
        <button onClick={loadAll} className="text-sm text-deep-purple hover:underline">再看看</button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-6 font-title">🏷️ 身份组管理</h1>

      {/* 发放临时身份组 */}
      <GrantTempRoleForm onSuccess={loadAll} />

      {/* 临时身份组 */}
      <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden mb-6" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-text-dark text-sm">⏰ 临时身份组</h2>
            <span className="text-xs text-text-light">({tempRoles.length} 个活跃)</span>
          </div>
          {selected.size > 0 && (
            <button
              onClick={handleBatchRemove}
              disabled={removing}
              className="px-3 py-1.5 text-white text-xs font-medium rounded-btn transition-all disabled:opacity-50"
              style={{ background: '#ff4466' }}
              onMouseEnter={e => { if (!removing) e.currentTarget.style.background = '#ff2244'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#ff4466'}
            >
              {removing ? "拿走中..." : `批量拿走 (${selected.size})`}
            </button>
          )}
        </div>

        {tempRoles.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-light text-sm">
            <div className="text-5xl mb-3">⏰</div>
            🐧 目前没有临时身份组呢
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(107,92,231,0.04)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
                  <th className="text-left px-5 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === tempRoles.length && tempRoles.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                      style={{ accentColor: 'var(--deep-purple)' }}
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">用户 ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">身份组 ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">授予者 ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">授予时间</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">到期时间</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">剩余</th>
                  <th className="text-right px-5 py-2.5 font-semibold text-text-dark">操作</th>
                </tr>
              </thead>
              <tbody>
                {tempRoles.map((role, idx) => {
                  const remaining = getRemaining(role.expire_at);
                  return (
                    <tr
                      key={role.id}
                      className="transition-colors"
                      style={{
                        background: idx % 2 === 0 ? 'var(--snow-white)' : 'white',
                        borderBottom: '1px solid rgba(107,92,231,0.06)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--snow-white)' : 'white'}
                    >
                      <td className="px-5 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(role.id)}
                          onChange={() => toggleSelect(role.id)}
                          className="rounded"
                          style={{ accentColor: 'var(--deep-purple)' }}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-dark">{role.user_id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-dark">{role.role_id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-light">{role.granted_by}</td>
                      <td className="px-3 py-2.5 text-xs text-text-light">{formatTime(role.granted_at)}</td>
                      <td className="px-3 py-2.5 text-xs text-text-light">{formatTime(role.expire_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium ${remaining.urgent ? "text-red-500" : "text-text-mid"}`}>
                          {remaining.text}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          onClick={() => handleRemoveSingle(role.id)}
                          disabled={removing}
                          className="text-xs font-medium px-3 py-1 rounded-btn transition-colors disabled:opacity-50"
                          style={{ color: '#ff4466' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-pink)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                        >
                          拿走
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 订阅面板 */}
      <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
          <h2 className="font-semibold text-text-dark text-sm">🔔 订阅面板</h2>
          <span className="text-xs text-text-light">({panels.length} 个)</span>
        </div>

        {panels.length === 0 ? (
          <div className="px-5 py-12 text-center text-text-light text-sm">
            <div className="text-5xl mb-3">🔔</div>
            🐧 暂无订阅面板呢
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(107,92,231,0.04)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
                  <th className="text-left px-5 py-2.5 font-semibold text-text-dark">消息 ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">频道 ID</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">身份组</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-text-dark">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {panels.map((panel, idx) => {
                  const roleIds = parseRoleIds(panel.role_ids);
                  return (
                    <tr
                      key={panel.id}
                      className="transition-colors"
                      style={{
                        background: idx % 2 === 0 ? 'var(--snow-white)' : 'white',
                        borderBottom: '1px solid rgba(107,92,231,0.06)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--snow-white)' : 'white'}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-text-dark">{panel.message_id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-dark">{panel.channel_id}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {roleIds.map((rid, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg text-xs font-mono" style={{ background: 'rgba(107,92,231,0.08)', color: 'var(--deep-purple)' }}>
                              {rid}
                            </span>
                          ))}
                          {roleIds.length === 0 && <span className="text-text-light text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-light">{formatTime(panel.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 辅助函数 ============

// ============ 发放临时身份组表单 ============

function GrantTempRoleForm({ onSuccess }) {
  const [userId, setUserId] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function handleGrant() {
    if (!userId.trim() || !roleId.trim() || !duration.trim()) {
      setResult({ error: "请填写所有字段" });
      return;
    }

    // 计算到期时间
    const expireAt = calculateExpireTime(duration.trim());
    if (!expireAt) {
      setResult({ error: "时间格式不对呀～例：30m / 2h / 7d / 1d12h" });
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const resp = await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          task_type: "grant_temp_role",
          payload: {
            user_id: parseInt(userId),
            role_id: parseInt(roleId),
            expire_at: expireAt,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "创建任务失败");

      // 轮询结果
      const taskResult = await pollTask(data.task_id);
      if (taskResult.error) {
        setResult({ error: taskResult.error });
      } else {
        setResult({ ok: true });
        setUserId("");
        setRoleId("");
        setDuration("");
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden mb-6" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">🎁 发放临时身份组</h2>
        <p className="text-xs text-text-light mt-0.5">直接在面板给成员发放有时限的身份组</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-text-mid mb-1">用户 ID</label>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="如：123456789"
              className="w-full px-3 py-2 text-sm rounded-btn font-mono transition-all"
              style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-mid mb-1">身份组 ID</label>
            <input
              type="text"
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              placeholder="如：987654321"
              className="w-full px-3 py-2 text-sm rounded-btn font-mono transition-all"
              style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-mid mb-1">时长</label>
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="30m / 2h / 7d"
              className="w-full px-3 py-2 text-sm rounded-btn transition-all"
              style={{ border: '1.5px solid rgba(107,92,231,0.15)', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = 'var(--deep-purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(107,92,231,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(107,92,231,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGrant}
              disabled={sending}
              className="w-full py-2 text-white text-sm font-semibold rounded-btn transition-all disabled:opacity-50 hover:-translate-y-0.5"
              style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
            >
              {sending ? "发放中..." : "交给鹅！"}
            </button>
          </div>
        </div>

        <p className="text-xs text-text-light">
          用户ID和身份组ID可在Discord中右键复制（需开启开发者模式）。时长格式：30m（分钟）、2h（小时）、7d（天）、1d12h（组合）
        </p>

        {result && (
          <div className={`mt-3 rounded-2xl p-3 text-sm`}
            style={result.error ? {
              background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680'
            } : {
              background: 'var(--mint-green)', borderLeft: '4px solid #66cc99'
            }}
          >
            {result.error ? `${result.error}` : "身份组发放成功！到期后会自动移除哦～"}
          </div>
        )}
      </div>
    </div>
  );
}

// 前端计算到期时间的辅助函数
function calculateExpireTime(durationStr) {
  const pattern = /(\d+)\s*([dhm])/gi;
  let totalMs = 0;
  let match;
  while ((match = pattern.exec(durationStr)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'd') totalMs += value * 86400000;
    else if (unit === 'h') totalMs += value * 3600000;
    else if (unit === 'm') totalMs += value * 60000;
  }
  if (totalMs === 0) return null;
  return new Date(Date.now() + totalMs).toISOString();
}

// ============ 辅助函数 ============

function getRemaining(expireAt) {
  if (!expireAt) return { text: "-", urgent: false };
  try {
    const expire = new Date(expireAt);
    const now = new Date();
    const diff = (expire - now) / 1000;

    if (diff <= 0) return { text: "已过期", urgent: true };
    if (diff < 3600) return { text: `${Math.floor(diff / 60)} 分钟`, urgent: true };
    if (diff < 86400) return { text: `${Math.floor(diff / 3600)} 小时`, urgent: diff < 7200 };
    return { text: `${Math.floor(diff / 86400)} 天`, urgent: false };
  } catch {
    return { text: "-", urgent: false };
  }
}
