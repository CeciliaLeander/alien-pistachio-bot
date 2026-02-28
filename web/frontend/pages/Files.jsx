/* ============================================================
   文件管理页面
   左侧：帖子列表 | 右侧：文件列表 + 追踪记录 + 水印验证
   风格：可爱冰雪甜品
   ============================================================ */

function FilesPage() {
  const [posts, setPosts] = React.useState({});        // { postName: [file, ...] }
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [tracking, setTracking] = React.useState([]);
  const [trackingOpen, setTrackingOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);

  // 水印验证
  const [verifyResult, setVerifyResult] = React.useState(null);
  const [verifying, setVerifying] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  // 加载帖子列表
  React.useEffect(() => { loadFiles(); }, []);

  async function loadFiles() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api("/files");
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setPosts(data.posts || {});
      // 如果当前选中的帖子不在列表中，清除选中
      if (selectedPost && !data.posts[selectedPost]) {
        setSelectedPost(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // 加载追踪记录
  async function loadTracking(postName) {
    try {
      const resp = await api(`/tracking/${encodeURIComponent(postName)}?limit=100`);
      if (!resp.ok) throw new Error("加载失败");
      const data = await resp.json();
      setTracking(data.records || []);
    } catch {
      setTracking([]);
    }
  }

  function handleSelectPost(name) {
    setSelectedPost(name);
    setTrackingOpen(false);
    setTracking([]);
    setVerifyResult(null);
  }

  async function handleToggleTracking() {
    if (!trackingOpen && selectedPost) {
      await loadTracking(selectedPost);
    }
    setTrackingOpen(!trackingOpen);
  }

  // 删除文件
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const resp = await api(`/files/${deleteTarget.id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error("删除失败");
      setDeleteTarget(null);
      await loadFiles();
    } catch (e) {
      alert("删除失败: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  // 水印验证
  async function handleVerifyFile(file) {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await api("/files/verify-watermark", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        setVerifyResult({ error: data.error || "验证失败" });
      } else {
        setVerifyResult(data);
      }
    } catch (e) {
      setVerifyResult({ error: e.message });
    } finally {
      setVerifying(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVerifyFile(file);
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) handleVerifyFile(file);
  }

  const postNames = Object.keys(posts);
  const currentFiles = selectedPost ? (posts[selectedPost] || []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 snowflake-spin">❄️</div>
          <p className="text-text-mid text-sm">🐧 鹅在努力加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
        <p className="text-red-500 mb-3">❌ {error}</p>
        <button onClick={loadFiles} className="text-sm text-deep-purple hover:underline">再看看</button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-6 font-title">📁 鹅的小仓库</h1>

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* 左侧：帖子列表 */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
              <h2 className="font-semibold text-text-dark text-sm">帖子列表</h2>
              <span className="text-xs text-text-light">{postNames.length} 个</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {postNames.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-light text-sm">📭 🐧 仓库里空空的呀～</div>
              ) : (
                postNames.map(name => (
                  <button
                    key={name}
                    onClick={() => handleSelectPost(name)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedPost === name
                        ? "font-medium"
                        : "text-text-dark"
                    }`}
                    style={{
                      borderBottom: '1px solid rgba(107,92,231,0.04)',
                      background: selectedPost === name ? 'rgba(107,92,231,0.1)' : undefined,
                      color: selectedPost === name ? 'var(--deep-purple)' : undefined,
                    }}
                    onMouseEnter={e => { if (selectedPost !== name) e.currentTarget.style.background = 'var(--lavender)'; }}
                    onMouseLeave={e => { if (selectedPost !== name) e.currentTarget.style.background = ''; }}
                  >
                    <div className="truncate">{name}</div>
                    <div className="text-xs text-text-light mt-0.5">{posts[name].length} 个文件</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 水印验证区 */}
          <div className="mt-4">
            <WatermarkVerifier
              dragOver={dragOver}
              setDragOver={setDragOver}
              onDrop={handleDrop}
              onFileInput={handleFileInput}
              verifying={verifying}
              verifyResult={verifyResult}
            />
          </div>
        </div>

        {/* 右侧：文件列表 + 追踪记录 */}
        <div className="flex-1 min-w-0">
          {!selectedPost ? (
            <div className="bg-white rounded-card border border-deep-purple/[0.06] p-12 text-center" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
              <div className="text-5xl mb-3">📂</div>
              <p className="text-text-light">🐧 选择左侧的帖子查看文件呀～</p>
            </div>
          ) : (
            <div>
              {/* 帖子标题栏 */}
              <div className="bg-white rounded-card border border-deep-purple/[0.06] mb-4" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-dark">{selectedPost}</h2>
                    <p className="text-xs text-text-light mt-0.5">{currentFiles.length} 个文件</p>
                  </div>
                  <button
                    onClick={handleToggleTracking}
                    className={`text-sm px-4 py-2 rounded-btn transition-all font-medium ${
                      trackingOpen
                        ? "text-white"
                        : "text-text-mid"
                    }`}
                    style={{
                      background: trackingOpen ? 'var(--deep-purple)' : 'rgba(107,92,231,0.06)',
                      color: trackingOpen ? 'white' : undefined,
                    }}
                  >
                    {trackingOpen ? "隐藏追踪记录" : "查看追踪记录"}
                  </button>
                </div>
              </div>

              {/* 文件表格 */}
              <div className="bg-white rounded-2xl border border-deep-purple/[0.06] overflow-hidden mb-4" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(107,92,231,0.04)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
                      <th className="text-left px-5 py-3 font-semibold text-text-dark">文件名</th>
                      <th className="text-left px-3 py-3 font-semibold text-text-dark">版本</th>
                      <th className="text-left px-3 py-3 font-semibold text-text-dark">类型</th>
                      <th className="text-left px-3 py-3 font-semibold text-text-dark">上传时间</th>
                      <th className="text-right px-5 py-3 font-semibold text-text-dark">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentFiles.map((f, idx) => (
                      <tr
                        key={f.id}
                        className="transition-colors"
                        style={{
                          background: idx % 2 === 0 ? 'var(--snow-white)' : 'white',
                          borderBottom: '1px solid rgba(107,92,231,0.06)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--snow-white)' : 'white'}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <FileIcon type={f.file_type} />
                            <span className="text-text-dark truncate max-w-xs">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="bg-deep-purple/[0.08] text-deep-purple px-2 py-0.5 rounded-lg text-xs">{f.version}</span>
                        </td>
                        <td className="px-3 py-3 text-text-mid">{f.file_type}</td>
                        <td className="px-3 py-3 text-text-light text-xs">{formatTime(f.uploaded_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget(f)}
                            className="text-xs font-medium px-3 py-1 rounded-btn transition-colors"
                            style={{ color: '#ff4466' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-pink)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                          >
                            扔掉
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {currentFiles.length === 0 && (
                  <div className="px-5 py-8 text-center text-text-light text-sm">📭 🐧 仓库里空空的呀～</div>
                )}
              </div>

              {/* 追踪记录展开区 */}
              {trackingOpen && (
                <TrackingPanel records={tracking} postName={selectedPost} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <ConfirmModal
          title="确认扔掉"
          message={`🐧 确定要扔掉吗？鹅会心疼的…\n文件「${deleteTarget.file_name}」(${deleteTarget.version}) 将被永久删除。`}
          confirmText={deleting ? "扔掉中..." : "扔掉"}
          confirmDisabled={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ============ 子组件 ============

function FileIcon({ type }) {
  const iconMap = {
    image: "🖼️",
    json: "📄",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
  };
  const t = (type || "").toLowerCase();
  const icon = iconMap[t] || "📎";
  return <span className="text-lg">{icon}</span>;
}

function TrackingPanel({ records, postName }) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-card border border-deep-purple/[0.06] p-8 text-center text-text-light text-sm" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
        🐧 帖子「{postName}」暂无追踪记录呢
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h3 className="font-semibold text-text-dark text-sm">追踪记录 ({records.length})</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'rgba(107,92,231,0.04)', borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
            <th className="text-left px-5 py-2.5 font-semibold text-text-dark">追踪码</th>
            <th className="text-left px-3 py-2.5 font-semibold text-text-dark">用户</th>
            <th className="text-left px-3 py-2.5 font-semibold text-text-dark">文件</th>
            <th className="text-left px-3 py-2.5 font-semibold text-text-dark">版本</th>
            <th className="text-left px-3 py-2.5 font-semibold text-text-dark">获取时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{
                background: i % 2 === 0 ? 'var(--snow-white)' : 'white',
                borderBottom: '1px solid rgba(107,92,231,0.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--snow-white)' : 'white'}
            >
              <td className="px-5 py-2.5">
                <code className="bg-deep-purple/[0.08] text-deep-purple px-1.5 py-0.5 rounded-lg text-xs font-mono">{r.tracking_code}</code>
              </td>
              <td className="px-3 py-2.5 text-text-dark">{r.user_name}</td>
              <td className="px-3 py-2.5 text-text-mid truncate max-w-[200px]">{r.file_name}</td>
              <td className="px-3 py-2.5">
                <span className="bg-deep-purple/[0.08] text-deep-purple px-2 py-0.5 rounded-lg text-xs">{r.version}</span>
              </td>
              <td className="px-3 py-2.5 text-text-light text-xs">{formatTime(r.retrieved_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WatermarkVerifier({ dragOver, setDragOver, onDrop, onFileInput, verifying, verifyResult }) {
  const fileInputRef = React.useRef(null);

  return (
    <div className="bg-white rounded-card border border-deep-purple/[0.06] overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(107,92,231,0.08)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(107,92,231,0.06)' }}>
        <h2 className="font-semibold text-text-dark text-sm">🔍 闻一闻水印</h2>
      </div>
      <div className="p-4">
        {/* 拖拽区 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? 'var(--deep-purple)' : 'rgba(107,92,231,0.15)',
            background: dragOver ? 'var(--lavender)' : undefined,
          }}
          onMouseEnter={e => { if (!dragOver) { e.currentTarget.style.borderColor = 'var(--soft-purple)'; e.currentTarget.style.background = 'var(--snow-white)'; } }}
          onMouseLeave={e => { if (!dragOver) { e.currentTarget.style.borderColor = 'rgba(107,92,231,0.15)'; e.currentTarget.style.background = ''; } }}
        >
          {verifying ? (
            <div>
              <div className="text-2xl mb-2 snowflake-spin">❄️</div>
              <p className="text-sm text-text-mid">🐧 鹅在努力嗅探中...</p>
            </div>
          ) : (
            <div>
              <div className="text-2xl mb-2">📎</div>
              <p className="text-xs text-text-mid">拖拽或点击上传呀～</p>
              <p className="text-xs text-text-light mt-1">PNG / JPG / JSON</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.json"
            onChange={onFileInput}
            className="hidden"
          />
        </div>

        {/* 验证结果 */}
        {verifyResult && (
          <div className="mt-3">
            {verifyResult.error ? (
              <div className="rounded-2xl p-3 text-sm" style={{ background: 'var(--soft-pink)', borderLeft: '4px solid #ff6680' }}>
                ❌ {verifyResult.error}
              </div>
            ) : verifyResult.found ? (
              <div className="rounded-2xl p-3 text-sm space-y-1" style={{ background: 'var(--mint-green)', borderLeft: '4px solid #66cc99' }}>
                <p className="font-medium text-green-700">✅ 🐧 鹅找到啦！这个文件是 {verifyResult.user_name} 拿的！</p>
                <p className="text-green-600">
                  追踪码：<code className="font-mono px-1 rounded-lg" style={{ background: 'rgba(102,204,153,0.2)' }}>{verifyResult.tracking_code}</code>
                </p>
                <p className="text-green-600">用户：{verifyResult.user_name} ({verifyResult.user_id})</p>
                <p className="text-green-600">帖子：{verifyResult.post_name}</p>
                <p className="text-green-600">文件：{verifyResult.file_name} ({verifyResult.version})</p>
                <p className="text-green-600 text-xs">获取时间：{verifyResult.retrieved_at}</p>
              </div>
            ) : (
              <div className="rounded-2xl p-3 text-sm" style={{ background: 'var(--warm-peach)', borderLeft: '4px solid #ffb366' }}>
                {verifyResult.tracking_code ? (
                  <div>
                    <p>追踪码：<code className="font-mono px-1 rounded-lg" style={{ background: 'rgba(255,179,102,0.2)' }}>{verifyResult.tracking_code}</code></p>
                    <p className="mt-1">⚠️ {verifyResult.message}</p>
                  </div>
                ) : (
                  <p>🐧 鹅闻了闻…没有闻到水印的味道呢</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmText, confirmDisabled, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(58,51,85,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      ></div>
      <div className="relative bg-white rounded-modal p-6 max-w-sm w-full mx-4" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h3 className="text-lg font-semibold text-text-dark mb-2 font-title">{title}</h3>
        <p className="text-sm text-text-mid mb-6 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-btn transition-all border"
            style={{ color: 'var(--deep-purple)', borderColor: 'var(--deep-purple)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(107,92,231,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            算了算了
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm text-white font-medium rounded-btn transition-all disabled:opacity-50"
            style={{ background: '#ff4466' }}
            onMouseEnter={e => { if (!confirmDisabled) e.currentTarget.style.background = '#ff2244'; }}
            onMouseLeave={e => e.currentTarget.style.background = '#ff4466'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
