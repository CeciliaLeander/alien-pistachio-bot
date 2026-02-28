"""
Bot 配置管理 API
"""

import json
import os
import sqlite3
from datetime import datetime

from flask import Blueprint, request, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

config_bp = Blueprint("config", __name__, url_prefix="/api/config")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@config_bp.route("")
@require_admin
def list_config():
    """列出所有配置项"""
    conn = _db()
    rows = conn.execute("SELECT key, value, updated_at FROM bot_config ORDER BY key").fetchall()
    conn.close()

    configs = {}
    for row in rows:
        try:
            configs[row["key"]] = {
                "value": json.loads(row["value"]),
                "updated_at": row["updated_at"],
            }
        except (json.JSONDecodeError, TypeError):
            configs[row["key"]] = {
                "value": row["value"],
                "updated_at": row["updated_at"],
            }

    return jsonify({"configs": configs})


@config_bp.route("/<key>")
@require_admin
def get_config_item(key):
    """获取单个配置项"""
    conn = _db()
    row = conn.execute("SELECT value, updated_at FROM bot_config WHERE key = ?", (key,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "配置项不存在"}), 404

    try:
        value = json.loads(row["value"])
    except (json.JSONDecodeError, TypeError):
        value = row["value"]

    return jsonify({"key": key, "value": value, "updated_at": row["updated_at"]})


@config_bp.route("/<key>", methods=["PUT"])
@require_admin
def update_config_item(key):
    """更新配置项"""
    data = request.get_json()
    if data is None or "value" not in data:
        return jsonify({"error": "请提供 value 字段"}), 400

    value = data["value"]
    now = datetime.now().isoformat()

    # 验证特定配置的格式
    if key == "admin_role_names":
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            return jsonify({"error": "admin_role_names 必须是字符串数组"}), 400
        if len(value) == 0:
            return jsonify({"error": "至少需要一个管理员身份组"}), 400

    if key == "anon_nicknames":
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            return jsonify({"error": "anon_nicknames 必须是字符串数组"}), 400

    if key in ("welcome_message", "rules_message"):
        if not isinstance(value, dict):
            return jsonify({"error": f"{key} 必须是对象"}), 400
        if "text" not in value:
            return jsonify({"error": f"{key} 必须包含 text 字段"}), 400

    value_json = json.dumps(value, ensure_ascii=False)

    conn = _db()
    conn.execute(
        "INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value_json, now),
    )
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "key": key, "updated_at": now})
