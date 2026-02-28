"""
任务队列 API
Flask 写入任务 → Bot 定时循环读取并执行 → 写回结果
Flask 可轮询任务状态返回给前端
"""

import json
import os
import sqlite3
from datetime import datetime

from flask import Blueprint, request, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

VALID_TASK_TYPES = [
    "draw_lottery",
    "cancel_lottery",
    "remove_temp_role",
    "grant_temp_role",
    "bulk_delete",
    "send_announcement",
]

tasks_bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@tasks_bp.route("", methods=["POST"])
@require_admin
def create_task():
    """创建任务，返回 task_id"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "请提供 JSON 请求体"}), 400

    task_type = data.get("task_type")
    payload = data.get("payload", {})

    if task_type not in VALID_TASK_TYPES:
        return jsonify({"error": f"无效的任务类型，可选：{VALID_TASK_TYPES}"}), 400

    conn = _db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO web_tasks (task_type, payload, status, created_at) VALUES (?, ?, 'pending', ?)",
        (task_type, json.dumps(payload, ensure_ascii=False), datetime.now().isoformat()),
    )
    task_id = c.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "task_id": task_id}), 201


@tasks_bp.route("/<int:task_id>")
@require_admin
def get_task(task_id):
    """查询任务状态和结果"""
    conn = _db()
    row = conn.execute("SELECT * FROM web_tasks WHERE id = ?", (task_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "任务不存在"}), 404

    result = dict(row)
    # 解析 JSON 字段
    try:
        result["payload"] = json.loads(result["payload"])
    except (json.JSONDecodeError, TypeError):
        pass
    try:
        if result["result"]:
            result["result"] = json.loads(result["result"])
    except (json.JSONDecodeError, TypeError):
        pass

    return jsonify(result)
