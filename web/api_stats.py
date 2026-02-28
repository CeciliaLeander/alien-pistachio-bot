"""
仪表盘统计 API
"""

import os
import sqlite3

from flask import Blueprint, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

stats_bp = Blueprint("stats", __name__, url_prefix="/api")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@stats_bp.route("/stats")
@require_admin
def get_stats():
    """返回仪表盘概览数据"""
    conn = _db()

    # 统计数字
    total_files = conn.execute("SELECT COUNT(*) AS c FROM files").fetchone()["c"]
    total_posts = conn.execute("SELECT COUNT(DISTINCT post_name) AS c FROM files").fetchone()["c"]
    active_lotteries = conn.execute("SELECT COUNT(*) AS c FROM lotteries WHERE status = 'active'").fetchone()["c"]
    active_temp_roles = conn.execute("SELECT COUNT(*) AS c FROM temp_roles WHERE status = 'active'").fetchone()["c"]
    anon_channels = conn.execute("SELECT COUNT(*) AS c FROM anon_channels").fetchone()["c"]
    total_tracking = conn.execute("SELECT COUNT(*) AS c FROM tracking").fetchone()["c"]

    # 最近追踪记录（5条）
    recent_tracking = conn.execute(
        "SELECT tracking_code, user_name, post_name, file_name, version, retrieved_at "
        "FROM tracking ORDER BY retrieved_at DESC LIMIT 5"
    ).fetchall()

    # 最近抽奖（5条）
    recent_lotteries = conn.execute(
        "SELECT id, title, prize, winner_count, status, created_at, end_time, "
        "(SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = lotteries.id) AS entry_count "
        "FROM lotteries ORDER BY created_at DESC LIMIT 5"
    ).fetchall()

    # 最近临时身份组变动（5条）
    recent_temp_roles = conn.execute(
        "SELECT id, user_id, role_id, granted_by, granted_at, expire_at, status "
        "FROM temp_roles ORDER BY granted_at DESC LIMIT 5"
    ).fetchall()

    conn.close()

    return jsonify({
        "counts": {
            "total_files": total_files,
            "total_posts": total_posts,
            "active_lotteries": active_lotteries,
            "active_temp_roles": active_temp_roles,
            "anon_channels": anon_channels,
            "total_tracking": total_tracking,
        },
        "recent_tracking": [dict(r) for r in recent_tracking],
        "recent_lotteries": [dict(r) for r in recent_lotteries],
        "recent_temp_roles": [dict(r) for r in recent_temp_roles],
    })
