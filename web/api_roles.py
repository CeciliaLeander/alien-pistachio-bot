"""
身份组 API
"""

import os
import sqlite3

from flask import Blueprint, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

roles_bp = Blueprint("roles", __name__, url_prefix="/api")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@roles_bp.route("/temp-roles")
@require_admin
def list_temp_roles():
    """列出所有活跃的临时身份组"""
    conn = _db()
    rows = conn.execute(
        "SELECT id, guild_id, user_id, role_id, granted_by, granted_at, expire_at, status "
        "FROM temp_roles WHERE status = 'active' ORDER BY expire_at ASC"
    ).fetchall()
    conn.close()

    return jsonify({"temp_roles": [dict(r) for r in rows]})


@roles_bp.route("/temp-roles/<int:role_entry_id>", methods=["DELETE"])
@require_admin
def delete_temp_role(role_entry_id):
    """
    手动移除某个临时身份组记录（标记为 removed）。
    实际从 Discord 移除身份组需要 Bot 实例，后续可通过 IPC 触发。
    """
    conn = _db()
    row = conn.execute("SELECT id, status FROM temp_roles WHERE id = ?", (role_entry_id,)).fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "记录不存在"}), 404

    if row["status"] != "active":
        conn.close()
        return jsonify({"error": f"记录状态为 {row['status']}，无法操作"}), 400

    conn.execute("UPDATE temp_roles SET status = 'removed' WHERE id = ?", (role_entry_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})


@roles_bp.route("/subscribe-panels")
@require_admin
def list_subscribe_panels():
    """列出所有订阅面板"""
    conn = _db()
    rows = conn.execute(
        "SELECT id, message_id, channel_id, guild_id, role_ids, created_at "
        "FROM subscribe_panels ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    return jsonify({"panels": [dict(r) for r in rows]})
