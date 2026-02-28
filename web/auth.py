"""
Discord OAuth2 认证模块
流程：前端跳转 Discord 授权 → 回调换 token → 获取用户信息 + 身份组 → 验证管理员
"""

import os
import hashlib
import json
import time
import sqlite3

import requests
from flask import Blueprint, redirect, request, jsonify, session

# ============ 配置 ============
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "")
GUILD_ID = 1446888252194816132
ADMIN_ROLE_NAMES = ["开心果bot", "见习开心果bot"]

DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"

# session token 有效期（秒）：7 天
TOKEN_EXPIRY = 7 * 24 * 3600

DATA_DIR = "/data"
DB_PATH = os.path.join(DATA_DIR, "bot.db")

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ============ 数据库辅助 ============

def _ensure_sessions_table():
    """确保 sessions 表存在"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS web_sessions (
            token       TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            username    TEXT NOT NULL,
            avatar      TEXT,
            created_at  REAL NOT NULL,
            expires_at  REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def _create_session(user_id: str, username: str, avatar: str | None) -> str:
    """创建 session 并返回 token"""
    token = hashlib.sha256(f"{user_id}-{time.time()}-{os.urandom(16).hex()}".encode()).hexdigest()
    now = time.time()
    expires = now + TOKEN_EXPIRY

    conn = sqlite3.connect(DB_PATH)
    # 清除该用户旧 session
    conn.execute("DELETE FROM web_sessions WHERE user_id = ?", (user_id,))
    conn.execute(
        "INSERT INTO web_sessions (token, user_id, username, avatar, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        (token, user_id, username, avatar, now, expires),
    )
    conn.commit()
    conn.close()
    return token


def _get_session(token: str) -> dict | None:
    """根据 token 获取 session，过期则删除并返回 None"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM web_sessions WHERE token = ?", (token,)).fetchone()
    if not row:
        conn.close()
        return None
    if row["expires_at"] < time.time():
        conn.execute("DELETE FROM web_sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return None
    conn.close()
    return dict(row)


def _delete_session(token: str):
    """删除 session"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM web_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()


# ============ 辅助函数 ============

def _get_token_from_request() -> str | None:
    """从请求头 Authorization: Bearer <token> 中提取 token"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def _exchange_code(code: str) -> dict | None:
    """用 authorization code 换取 access_token"""
    resp = requests.post(
        DISCORD_TOKEN_URL,
        data={
            "client_id": DISCORD_CLIENT_ID,
            "client_secret": DISCORD_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": DISCORD_REDIRECT_URI,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def _get_user_info(access_token: str) -> dict | None:
    """获取 Discord 用户信息"""
    resp = requests.get(
        f"{DISCORD_API_BASE}/users/@me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def _get_guild_member(access_token: str) -> dict | None:
    """获取用户在目标服务器中的成员信息（含身份组）"""
    resp = requests.get(
        f"{DISCORD_API_BASE}/users/@me/guilds/{GUILD_ID}/member",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def _get_guild_roles() -> dict:
    """用 Bot Token 获取服务器所有身份组，返回 {role_id: role_name} 映射"""
    bot_token = os.getenv("BOT_TOKEN", "")
    resp = requests.get(
        f"{DISCORD_API_BASE}/guilds/{GUILD_ID}/roles",
        headers={"Authorization": f"Bot {bot_token}"},
        timeout=10,
    )
    if resp.status_code != 200:
        return {}
    return {role["id"]: role["name"] for role in resp.json()}


def _is_admin(member_role_ids: list, guild_roles: dict) -> bool:
    """检查成员身份组中是否包含管理员身份组"""
    # 从数据库读取管理员身份组名称
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT value FROM bot_config WHERE key = 'admin_role_names'")
    result = c.fetchone()
    conn.close()

    if result:
        try:
            admin_names = json.loads(result[0])
        except (json.JSONDecodeError, TypeError):
            admin_names = ADMIN_ROLE_NAMES
    else:
        admin_names = ADMIN_ROLE_NAMES

    for role_id in member_role_ids:
        role_name = guild_roles.get(str(role_id), guild_roles.get(role_id, ""))
        if role_name in admin_names:
            return True
    return False


# ============ 路由 ============

@auth_bp.route("/login")
def login():
    """重定向到 Discord 授权页面"""
    params = (
        f"client_id={DISCORD_CLIENT_ID}"
        f"&redirect_uri={DISCORD_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=identify+guilds.members.read"
    )
    return redirect(f"{DISCORD_AUTH_URL}?{params}")


@auth_bp.route("/callback")
def callback():
    """处理 Discord OAuth2 回调"""
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "缺少授权码"}), 400

    # 1. 用 code 换 access_token
    token_data = _exchange_code(code)
    if not token_data or "access_token" not in token_data:
        return jsonify({"error": "获取 access_token 失败"}), 400

    access_token = token_data["access_token"]

    # 2. 获取用户信息
    user_info = _get_user_info(access_token)
    if not user_info:
        return jsonify({"error": "获取用户信息失败"}), 400

    # 3. 获取用户在服务器中的成员信息
    member_info = _get_guild_member(access_token)
    if not member_info:
        return jsonify({"error": "你不在目标服务器中，无法登录"}), 403

    # 4. 获取服务器身份组列表并验证管理员
    guild_roles = _get_guild_roles()
    member_role_ids = member_info.get("roles", [])

    if not _is_admin(member_role_ids, guild_roles):
        return jsonify({"error": "你没有管理员权限，无法登录"}), 403

    # 5. 创建 session
    user_id = user_info["id"]
    username = user_info.get("global_name") or user_info.get("username", "")
    avatar = user_info.get("avatar")
    if avatar:
        avatar = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar}.png"

    session_token = _create_session(user_id, username, avatar)

    # 6. 重定向回前端，token 放在 URL fragment 中（不发送到服务器）
    return redirect(f"/?token={session_token}")


@auth_bp.route("/me")
def me():
    """返回当前登录用户信息"""
    token = _get_token_from_request()
    if not token:
        return jsonify({"error": "未登录"}), 401

    sess = _get_session(token)
    if not sess:
        return jsonify({"error": "登录已过期"}), 401

    return jsonify({
        "user_id": sess["user_id"],
        "username": sess["username"],
        "avatar": sess["avatar"],
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """注销登录"""
    token = _get_token_from_request()
    if token:
        _delete_session(token)
    return jsonify({"ok": True})


# ============ 认证装饰器（供其他蓝图使用） ============

def require_admin(f):
    """装饰器：要求请求携带有效的管理员 session token"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        token = _get_token_from_request()
        if not token:
            return jsonify({"error": "未登录"}), 401

        sess = _get_session(token)
        if not sess:
            return jsonify({"error": "登录已过期"}), 401

        # 把用户信息注入到 request context 中
        request.admin_user = {
            "user_id": sess["user_id"],
            "username": sess["username"],
            "avatar": sess["avatar"],
        }
        return f(*args, **kwargs)

    return decorated


# 应用启动时确保表存在
_ensure_sessions_table()
