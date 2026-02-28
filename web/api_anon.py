"""
匿名区 API
"""

import os
import sqlite3

from flask import Blueprint, request, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

anon_bp = Blueprint("anon", __name__, url_prefix="/api/anon")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@anon_bp.route("/channels")
@require_admin
def list_channels():
    """列出所有匿名频道"""
    conn = _db()
    rows = conn.execute(
        "SELECT guild_id, channel_id, set_by, set_at FROM anon_channels ORDER BY set_at DESC"
    ).fetchall()
    conn.close()

    return jsonify({"channels": [dict(r) for r in rows]})


@anon_bp.route("/messages")
@require_admin
def list_messages():
    """查询匿名消息记录"""
    channel_id = request.args.get("channel_id", type=int)
    limit = request.args.get("limit", 50, type=int)
    limit = min(limit, 200)

    conn = _db()
    if channel_id:
        rows = conn.execute(
            "SELECT id, bot_message_id, channel_id, nickname, content, sent_at "
            "FROM anon_messages WHERE channel_id = ? ORDER BY sent_at DESC LIMIT ?",
            (channel_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, bot_message_id, channel_id, nickname, content, sent_at "
            "FROM anon_messages ORDER BY sent_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()

    return jsonify({"messages": [dict(r) for r in rows]})


@anon_bp.route("/identity/<int:message_id>")
@require_admin
def get_identity(message_id):
    """查看某条匿名消息的真实身份（通过 bot_message_id 查询）"""
    conn = _db()
    row = conn.execute(
        "SELECT id, bot_message_id, channel_id, user_id, nickname, content, sent_at "
        "FROM anon_messages WHERE bot_message_id = ?",
        (message_id,),
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "消息不存在"}), 404

    return jsonify({
        "bot_message_id": row["bot_message_id"],
        "channel_id": row["channel_id"],
        "user_id": row["user_id"],
        "nickname": row["nickname"],
        "content": row["content"],
        "sent_at": row["sent_at"],
    })
