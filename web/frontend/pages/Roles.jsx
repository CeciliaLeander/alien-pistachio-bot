/* ============================================================
   身份组管理页面
   临时身份组列表（含批量移除） + 订阅面板列表
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
    if (!confirm("确定要移除此临时身份组吗？")) return;
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
    if (!confirm(`确定要批量移除 ${selected.size} 个临时身份组吗？`)) return;
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
        <div className="text-4xl animate-bounce">🐧</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <button onClick={loadAll} className="text-sm text-red-500 hover:text-red-700 underline">重试</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">身份组管理</h1>

      {/* 临时身份组 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700 text-sm">临时身份组</h2>
            <span className="text-xs text-gray-400">({tempRoles.length} 个活跃)</span>
          </div>
          {selected.size > 0 && (
            <button
              onClick={handleBatchRemove}
              disabled={removing}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {removing ? "移除中..." : `批量移除 (${selected.size})`}
            </button>
          )}
        </div>

        {tempRoles.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-300 text-sm">暂无活跃的临时身份组</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === tempRoles.length && tempRoles.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">用户 ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">身份组 ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">授予者 ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">授予时间</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">到期时间</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">剩余</th>
                <th className="text-right px-5 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tempRoles.map(role => {
                const remaining = getRemaining(role.expire_at);
                return (
                  <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(role.id)}
                        onChange={() => toggleSelect(role.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{role.user_id}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{role.role_id}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{role.granted_by}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{formatTime(role.granted_at)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{formatTime(role.expire_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${remaining.urgent ? "text-red-500" : "text-gray-600"}`}>
                        {remaining.text}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => handleRemoveSingle(role.id)}
                        disabled={removing}
                        className="text-red-400 hover:text-red-600 text-xs transition-colors disabled:opacity-50"
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 订阅面板 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <h2 className="font-semibold text-gray-700 text-sm">订阅面板</h2>
          <span className="text-xs text-gray-400">({panels.length} 个)</span>
        </div>

        {panels.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-300 text-sm">暂无订阅面板</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-2.5 font-medium text-gray-500">消息 ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">频道 ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">身份组</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {panels.map(panel => {
                const roleIds = parseRoleIds(panel.role_ids);
                return (
                  <tr key={panel.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{panel.message_id}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{panel.channel_id}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {roleIds.map((rid, i) => (
                          <span key={i} className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-xs font-mono">
                            {rid}
                          </span>
                        ))}
                        {roleIds.length === 0 && <span className="text-gray-400 text-xs">-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{formatTime(panel.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
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
