/* ============================================================
   文件管理页面
   左侧：帖子列表 | 右侧：文件列表 + 追踪记录 + 水印验证
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
        <div className="text-4xl animate-bounce">🐧</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <button onClick={loadFiles} className="text-sm text-red-500 hover:text-red-700 underline">重试</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">文件管理</h1>

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* 左侧：帖子列表 */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 text-sm">帖子列表</h2>
              <span className="text-xs text-gray-400">{postNames.length} 个</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {postNames.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-300 text-sm">暂无帖子</div>
              ) : (
                postNames.map(name => (
                  <button
                    key={name}
                    onClick={() => handleSelectPost(name)}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 transition-colors ${
                      selectedPost === name
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="truncate">{name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{posts[name].length} 个文件</div>
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-400">选择左侧的帖子查看文件</p>
            </div>
          ) : (
            <div>
              {/* 帖子标题栏 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">{selectedPost}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{currentFiles.length} 个文件</p>
                  </div>
                  <button
                    onClick={handleToggleTracking}
                    className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                      trackingOpen
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {trackingOpen ? "隐藏追踪记录" : "查看追踪记录"}
                  </button>
                </div>
              </div>

              {/* 文件表格 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">文件名</th>
                      <th className="text-left px-3 py-3 font-medium text-gray-500">版本</th>
                      <th className="text-left px-3 py-3 font-medium text-gray-500">类型</th>
                      <th className="text-left px-3 py-3 font-medium text-gray-500">上传时间</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentFiles.map(f => (
                      <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <FileIcon type={f.file_type} />
                            <span className="text-gray-800 truncate max-w-xs">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{f.version}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{f.file_type}</td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{formatTime(f.uploaded_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget(f)}
                            className="text-red-400 hover:text-red-600 text-xs transition-colors"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {currentFiles.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-300 text-sm">此帖子下暂无文件</div>
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
          title="确认删除"
          message={`确定要删除文件「${deleteTarget.file_name}」(${deleteTarget.version}) 吗？此操作不可撤销。`}
          confirmText={deleting ? "删除中..." : "确认删除"}
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-300 text-sm">
        帖子「{postName}」暂无追踪记录
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm">追踪记录 ({records.length})</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left px-5 py-2.5 font-medium text-gray-500">追踪码</th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500">用户</th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500">文件</th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500">版本</th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-500">获取时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {records.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-2.5">
                <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">{r.tracking_code}</code>
              </td>
              <td className="px-3 py-2.5 text-gray-700">{r.user_name}</td>
              <td className="px-3 py-2.5 text-gray-500 truncate max-w-[200px]">{r.file_name}</td>
              <td className="px-3 py-2.5">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{r.version}</span>
              </td>
              <td className="px-3 py-2.5 text-gray-400 text-xs">{formatTime(r.retrieved_at)}</td>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-700 text-sm">水印验证</h2>
      </div>
      <div className="p-4">
        {/* 拖拽区 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          {verifying ? (
            <div>
              <div className="text-2xl animate-spin mb-2">🔍</div>
              <p className="text-sm text-gray-500">验证中...</p>
            </div>
          ) : (
            <div>
              <div className="text-2xl mb-2">📎</div>
              <p className="text-xs text-gray-500">拖拽或点击上传</p>
              <p className="text-xs text-gray-400 mt-1">PNG / JPG / JSON</p>
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {verifyResult.error}
              </div>
            ) : verifyResult.found ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-green-700">找到水印</p>
                <p className="text-green-600">
                  追踪码：<code className="font-mono bg-green-100 px-1 rounded">{verifyResult.tracking_code}</code>
                </p>
                <p className="text-green-600">用户：{verifyResult.user_name} ({verifyResult.user_id})</p>
                <p className="text-green-600">帖子：{verifyResult.post_name}</p>
                <p className="text-green-600">文件：{verifyResult.file_name} ({verifyResult.version})</p>
                <p className="text-green-600 text-xs">获取时间：{verifyResult.retrieved_at}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                {verifyResult.tracking_code ? (
                  <div>
                    <p>追踪码：<code className="font-mono bg-yellow-100 px-1 rounded">{verifyResult.tracking_code}</code></p>
                    <p className="mt-1">{verifyResult.message}</p>
                  </div>
                ) : (
                  <p>{verifyResult.message || "未检测到水印"}</p>
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
      <div className="absolute inset-0 bg-black/30" onClick={onCancel}></div>
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
