"""
抽奖 API
"""

import os
import sqlite3
from datetime import datetime

from flask import Blueprint, request, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

lottery_bp = Blueprint("lottery", __name__, url_prefix="/api/lottery")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@lottery_bp.route("")
@require_admin
def list_lotteries():
    """列出所有抽奖，支持 ?status=active/ended/cancelled 筛选"""
    status = request.args.get("status")

    conn = _db()
    if status:
        rows = conn.execute(
            "SELECT l.*, "
            "(SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = l.id) AS entry_count "
            "FROM lotteries l WHERE l.status = ? ORDER BY l.created_at DESC",
            (status,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT l.*, "
            "(SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = l.id) AS entry_count "
            "FROM lotteries l ORDER BY l.created_at DESC"
        ).fetchall()
    conn.close()

    return jsonify({"lotteries": [dict(r) for r in rows]})


@lottery_bp.route("/<int:lottery_id>")
@require_admin
def get_lottery(lottery_id):
    """获取某个抽奖详情 + 参与者列表"""
    conn = _db()
    lottery = conn.execute(
        "SELECT * FROM lotteries WHERE id = ?", (lottery_id,)
    ).fetchone()

    if not lottery:
        conn.close()
        return jsonify({"error": "抽奖不存在"}), 404

    entries = conn.execute(
        "SELECT user_id, entered_at FROM lottery_entries WHERE lottery_id = ? ORDER BY entered_at",
        (lottery_id,),
    ).fetchall()
    conn.close()

    return jsonify({
        "lottery": dict(lottery),
        "entries": [dict(e) for e in entries],
    })


@lottery_bp.route("/<int:lottery_id>/draw", methods=["POST"])
@require_admin
def draw_lottery(lottery_id):
    """
    手动开奖 - 仅在数据库层面完成抽取，不发送 Discord 消息。
    （发送 Discord 消息需要 Bot 实例，后续可通过 IPC 机制触发）
    """
    import random

    conn = _db()
    c = conn.cursor()
    c.execute(
        "SELECT id, title, prize, winner_count, status FROM lotteries WHERE id = ?",
        (lottery_id,),
    )
    lottery = c.fetchone()

    if not lottery:
        conn.close()
        return jsonify({"error": "抽奖不存在"}), 404

    if lottery[4] != "active":
        conn.close()
        return jsonify({"error": f"抽奖状态为 {lottery[4]}，无法开奖"}), 400

    winner_count = lottery[3]

    c.execute("SELECT user_id FROM lottery_entries WHERE lottery_id = ?", (lottery_id,))
    entries = [row[0] for row in c.fetchall()]

    # 抽取中奖者
    if not entries:
        winners = []
    elif len(entries) <= winner_count:
        winners = entries
    else:
        winners = random.sample(entries, winner_count)

    # 更新状态
    c.execute(
        "UPDATE lotteries SET status = 'ended', ended_at = ? WHERE id = ?",
        (datetime.now().isoformat(), lottery_id),
    )
    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "lottery_id": lottery_id,
        "title": lottery[1],
        "prize": lottery[2],
        "total_entries": len(entries),
        "winners": winners,
    })


@lottery_bp.route("/<int:lottery_id>/cancel", methods=["POST"])
@require_admin
def cancel_lottery(lottery_id):
    """取消抽奖"""
    conn = _db()
    c = conn.cursor()
    c.execute("SELECT id, title, status FROM lotteries WHERE id = ?", (lottery_id,))
    lottery = c.fetchone()

    if not lottery:
        conn.close()
        return jsonify({"error": "抽奖不存在"}), 404

    if lottery[2] != "active":
        conn.close()
        return jsonify({"error": f"抽奖状态为 {lottery[2]}，无法取消"}), 400

    c.execute(
        "UPDATE lotteries SET status = 'cancelled', ended_at = ? WHERE id = ?",
        (datetime.now().isoformat(), lottery_id),
    )
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "title": lottery[1]})
