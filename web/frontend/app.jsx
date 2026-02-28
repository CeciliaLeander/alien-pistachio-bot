/* ============================================================
   小鹅子 Bot 管理面板 - React SPA
   技术栈：React 18 (CDN) + Hash Router (手写) + Tailwind CSS
   ============================================================ */

const { useState, useEffect, useCallback, createContext, useContext } = React;

// ============ API 辅助 ============

function getToken() {
  return localStorage.getItem("admin_token") || "";
}

function setToken(token) {
  localStorage.setItem("admin_token", token);
}

function clearToken() {
  localStorage.removeItem("admin_token");
}

async function api(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const resp = await fetch(`/api${path}`, { ...options, headers });
  if (resp.status === 401) {
    clearToken();
    window.location.hash = "#/login";
    throw new Error("未登录");
  }
  return resp;
}

// ============ Auth Context ============

const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

// ============ 简易 Hash Router ============

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");

  useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return route;
}

function navigate(path) {
  window.location.hash = "#" + path;
}

function Link({ to, children, className, activeClass, currentRoute }) {
  const isActive = currentRoute === to || (to !== "/" && currentRoute.startsWith(to));
  return (
    <a
      href={"#" + to}
      className={`${className || ""} ${isActive && activeClass ? activeClass : ""}`}
    >
      {children}
    </a>
  );
}

// ============ 页面占位组件 ============
// DashboardPage 已移至 pages/Dashboard.jsx

function PlaceholderPage({ title, icon }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">{icon} {title}</h1>
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center text-gray-400">
        此页面将在后续步骤中实现
      </div>
    </div>
  );
}

function FilesPage()   { return <PlaceholderPage title="文件管理" icon="📁" />; }
function AnonPage()    { return <PlaceholderPage title="匿名区管理" icon="🎭" />; }
function LotteryPage() { return <PlaceholderPage title="抽奖管理" icon="🎰" />; }
function RolesPage()   { return <PlaceholderPage title="身份组管理" icon="🏷️" />; }
function ToolsPage()   { return <PlaceholderPage title="工具" icon="🔧" />; }
function FaqPage()     { return <PlaceholderPage title="使用说明" icon="❓" />; }

// ============ 登录页 ============

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🐧</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">小鹅子管理面板</h1>
        <p className="text-gray-500 mb-8 text-sm">仅限拥有管理员身份组的成员登录</p>
        <a
          href="/api/auth/login"
          className="inline-flex items-center gap-2 bg-discord hover:bg-indigo-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Discord 登录
        </a>
      </div>
    </div>
  );
}

// ============ Sidebar ============

const NAV_ITEMS = [
  { path: "/",        icon: "📊", label: "仪表盘" },
  { path: "/files",   icon: "📁", label: "文件管理" },
  { path: "/anon",    icon: "🎭", label: "匿名区" },
  { path: "/lottery", icon: "🎰", label: "抽奖管理" },
  { path: "/roles",   icon: "🏷️", label: "身份组" },
  { path: "/tools",   icon: "🔧", label: "工具" },
  { path: "/faq",     icon: "❓", label: "使用说明" },
];

function Sidebar({ currentRoute }) {
  return (
    <aside className="w-60 bg-sidebar min-h-screen flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <span className="text-3xl">🐧</span>
        <div>
          <div className="text-white font-bold text-sm">小鹅子 Bot</div>
          <div className="text-gray-400 text-xs">管理面板</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === "/"
            ? currentRoute === "/"
            : currentRoute.startsWith(item.path);
          return (
            <a
              key={item.path}
              href={"#" + item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

// ============ Header ============

function Header({ user, onLogout }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">
        {/* breadcrumb placeholder */}
      </div>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-discord flex items-center justify-center text-white text-xs font-bold">
              {(user.username || "?")[0]}
            </div>
          )}
          <span className="text-sm text-gray-700">{user.username}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
            <button
              onClick={onLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ============ App Layout ============

function AppLayout({ user, onLogout }) {
  const route = useHashRoute();

  let page;
  if (route === "/" || route === "")      page = <DashboardPage />;
  else if (route.startsWith("/files"))    page = <FilesPage />;
  else if (route.startsWith("/anon"))     page = <AnonPage />;
  else if (route.startsWith("/lottery"))  page = <LotteryPage />;
  else if (route.startsWith("/roles"))    page = <RolesPage />;
  else if (route.startsWith("/tools"))    page = <ToolsPage />;
  else if (route.startsWith("/faq"))      page = <FaqPage />;
  else page = <DashboardPage />;

  return (
    <div className="flex min-h-screen">
      <Sidebar currentRoute={route} />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header user={user} onLogout={onLogout} />
        <main className="flex-1 p-6 overflow-auto">
          {page}
        </main>
      </div>
    </div>
  );
}

// ============ Root App ============

function App() {
  const [user, setUser] = useState(null);      // { user_id, username, avatar }
  const [loading, setLoading] = useState(true);

  // 页面加载时：检查 URL 中的 token 参数（OAuth 回调后带回来的）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      // 清除 URL 中的 token 参数
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, []);

  // 验证当前 token 是否有效
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        clearToken();
        setLoading(false);
      });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (_) {}
    clearToken();
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-main">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐧</div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AuthContext.Provider value={user}>
      <AppLayout user={user} onLogout={handleLogout} />
    </AuthContext.Provider>
  );
}

// ============ Mount ============

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
