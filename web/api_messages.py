"""
消息管理 API
批量删除等操作需要 Discord Bot 权限，前端只做触发，
实际执行通过 Bot 的 API 或 IPC 机制。
此模块为占位蓝图，后续步骤中对接 Bot IPC 后补充实际功能。
"""

from flask import Blueprint, jsonify

from auth import require_admin

messages_bp = Blueprint("messages", __name__, url_prefix="/api/messages")


@messages_bp.route("/status")
@require_admin
def status():
    """检查消息管理服务状态"""
    return jsonify({
        "available": False,
        "message": "消息管理功能需要通过 Bot IPC 机制执行，后续步骤中实现",
    })
