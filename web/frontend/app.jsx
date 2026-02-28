/* ============================================================
   小鹅子 Bot 管理面板 - React SPA
   技术栈：React 18 (CDN) + Hash Router (手写) + Tailwind CSS
   风格：可爱冰雪甜品
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
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-4 font-title">{icon} {title}</h1>
      <div className="bg-white rounded-card p-8 shadow-sm border border-deep-purple/[0.06] text-center text-text-light">
        此页面将在后续步骤中实现
      </div>
    </div>
  );
}

// FilesPage 已移至 pages/Files.jsx
// AnonPage 已移至 pages/Anon.jsx
// LotteryPage 已移至 pages/Lottery.jsx
// RolesPage 已移至 pages/Roles.jsx
// ToolsPage 已移至 pages/Tools.jsx

function FaqPage() {
  return (
    <div className="page-enter">
      <h1 className="text-2xl font-bold text-text-dark mb-2 font-title">❓ 常见问题</h1>
      <p className="text-text-mid text-sm mb-6">遇到问题先来这里找找看～</p>
      <div className="bg-white rounded-card p-12 shadow-sm border border-deep-purple/[0.06] text-center">
        <div className="text-6xl mb-4">📖</div>
        <p className="text-text-light">🐧 鹅正在整理常见问题中...</p>
      </div>
    </div>
  );
}

// ============ 登录页 ============

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--snow-white), var(--lavender), var(--ice-blue))' }}>
      <div className="bg-white rounded-modal shadow-lg p-10 max-w-sm w-full text-center border border-deep-purple/[0.06]" style={{ boxShadow: '0 20px 60px rgba(107,92,231,0.12)' }}>
        <div className="text-6xl mb-4 penguin-bounce">🐧</div>
        <h1 className="text-2xl font-bold text-text-dark mb-2 font-title">🐧 小鹅子管理手册</h1>
        <p className="text-text-mid mb-8 text-sm">鹅虽然没有大脑，但是会努力当好管家的！</p>
        <a
          href="/api/auth/login"
          className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-btn transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--deep-purple)', boxShadow: '0 4px 16px rgba(107,92,231,0.3)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          🐧 用 Discord 登录
        </a>
      </div>
    </div>
  );
}

// ============ Sidebar ============

const NAV_ITEMS = [
  { path: "/",        icon: "🏠", label: "首页" },
  { path: "/files",   icon: "📁", label: "文件管理" },
  { path: "/anon",    icon: "🎭", label: "匿名区" },
  { path: "/lottery", icon: "🎰", label: "抽奖" },
  { path: "/roles",   icon: "🏷️", label: "身份组" },
  { path: "/tools",   icon: "🔧", label: "工具" },
  { path: "/faq",     icon: "❓", label: "FAQ" },
];

function Sidebar({ currentRoute, isMobile, onClose }) {
  return (
    <aside className={`w-60 bg-white min-h-screen flex flex-col shrink-0 ${isMobile ? '' : 'border-r'}`} style={{ borderColor: 'rgba(107,92,231,0.08)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'rgba(107,92,231,0.08)' }}>
        <span className="text-3xl penguin-bounce">🐧</span>
        <div>
          <div className="font-bold text-sm font-title" style={{ color: 'var(--deep-purple)' }}>小鹅子</div>
          <div className="text-text-light text-xs">管理面板</div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="ml-auto text-text-light hover:text-text-dark text-lg">&times;</button>
        )}
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
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition-all ${
                isActive
                  ? "font-semibold"
                  : "text-text-mid hover:text-deep-purple"
              }`}
              style={isActive ? {
                background: 'rgba(107,92,231,0.1)',
                color: 'var(--deep-purple)',
              } : undefined}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(107,92,231,0.06)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ''; }}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* 底部 */}
      <div className="px-5 py-4 text-text-light text-xs text-center" style={{ borderTop: '1px solid rgba(107,92,231,0.08)' }}>
        🐧 鹅在值班中～
      </div>
    </aside>
  );
}

// ============ Header ============

function Header({ user, onLogout, onMenuToggle }) {
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0 sticky top-0 z-50 transition-shadow"
      style={{
        background: 'rgba(248,245,255,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(107,92,231,0.08)',
        boxShadow: scrolled ? '0 2px 20px rgba(107,92,231,0.1)' : 'none',
      }}
    >
      <div className="flex items-center gap-3">
        {/* 移动端汉堡菜单按钮 */}
        <button
          onClick={onMenuToggle}
          className="hidden mobile-menu-btn items-center justify-center w-8 h-8 rounded-lg hover:bg-deep-purple/[0.06] text-text-mid"
          style={{ display: 'none' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm text-text-mid">
          🐧 欢迎回来呀～{user.username}
        </span>
      </div>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-btn px-3 py-1.5 transition-colors hover:bg-deep-purple/[0.06]"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" style={{ border: '2px solid var(--soft-purple)' }} />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--deep-purple)' }}>
              {(user.username || "?")[0]}
            </div>
          )}
          <span className="text-sm text-text-dark">{user.username}</span>
          <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-btn shadow-lg py-1 z-50" style={{ border: '1px solid rgba(107,92,231,0.08)' }}>
            <button
              onClick={onLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-soft-pink/50 transition-colors"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ============ 返回顶部按钮 ============

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <button
      className={`back-to-top ${visible ? 'visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="返回顶部"
    >
      ↑
    </button>
  );
}

// ============ App Layout ============

function AppLayout({ user, onLogout }) {
  const route = useHashRoute();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      {/* 桌面端侧边栏 */}
      <div className="sidebar-desktop">
        <Sidebar currentRoute={route} onClose={() => {}} />
      </div>

      {/* 移动端侧边栏 */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>
      )}
      <div className={`sidebar-mobile ${mobileMenuOpen ? 'open' : ''}`}>
        <Sidebar currentRoute={route} isMobile onClose={() => setMobileMenuOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-h-screen">
        <Header user={user} onLogout={onLogout} onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-6 overflow-auto page-enter">
          {page}
        </main>
      </div>

      <BackToTop />
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--snow-white)' }}>
        <div className="text-center">
          <div className="text-5xl mb-4 penguin-bounce">🐧</div>
          <p className="text-text-mid text-sm">🐧 小鹅子正在翻找...</p>
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
