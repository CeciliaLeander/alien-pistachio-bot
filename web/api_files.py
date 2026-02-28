"""
文件管理 API
"""

import io
import os
import sqlite3

from flask import Blueprint, request, jsonify

from auth import require_admin

DB_PATH = os.path.join("/data", "bot.db")

files_bp = Blueprint("files", __name__, url_prefix="/api")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ============ 水印提取函数（复用 bot.py 的逻辑） ============

def _bits_to_text(bits):
    chars = []
    for i in range(0, len(bits), 8):
        byte_bits = bits[i:i + 8]
        if len(byte_bits) < 8:
            break
        byte = 0
        for bit in byte_bits:
            byte = (byte << 1) | bit
        if byte == 0:
            break
        chars.append(chr(byte))
    return "".join(chars)


def _extract_image_watermark(image_bytes):
    """从图片中提取隐藏的追踪码"""
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    pixels = list(img.getdata())

    bits = []
    for pixel in pixels:
        for channel in range(3):
            bits.append(pixel[channel] & 1)

    text = _bits_to_text(bits)
    start = text.find("<<")
    end = text.find(">>")
    if start != -1 and end != -1:
        return text[start + 2:end]
    return None


def _extract_json_watermark(json_bytes):
    """从 JSON 文件的 extensions 字段中提取追踪码"""
    import json

    content = json_bytes.decode("utf-8")
    data = json.loads(content)

    if "data" in data and isinstance(data["data"], dict):
        ext = data["data"].get("extensions", {})
        if isinstance(ext, dict) and "tracking_id" in ext:
            return ext["tracking_id"]

    ext = data.get("extensions", {})
    if isinstance(ext, dict) and "tracking_id" in ext:
        return ext["tracking_id"]

    return None


# ============ 路由 ============

@files_bp.route("/files")
@require_admin
def list_files():
    """列出所有帖子及其文件"""
    conn = _db()
    rows = conn.execute(
        "SELECT id, post_name, file_name, version, file_type, uploaded_by, uploaded_at "
        "FROM files ORDER BY uploaded_at DESC"
    ).fetchall()
    conn.close()

    # 按帖子分组
    posts = {}
    for r in rows:
        name = r["post_name"]
        if name not in posts:
            posts[name] = []
        posts[name].append({
            "id": r["id"],
            "file_name": r["file_name"],
            "version": r["version"],
            "file_type": r["file_type"],
            "uploaded_by": r["uploaded_by"],
            "uploaded_at": r["uploaded_at"],
        })

    return jsonify({"posts": posts})


@files_bp.route("/files/<post_name>")
@require_admin
def get_post_files(post_name):
    """获取某帖子的文件列表"""
    conn = _db()
    rows = conn.execute(
        "SELECT id, file_name, version, file_type, uploaded_by, uploaded_at "
        "FROM files WHERE post_name = ? ORDER BY uploaded_at DESC",
        (post_name,),
    ).fetchall()
    conn.close()

    return jsonify({
        "post_name": post_name,
        "files": [dict(r) for r in rows],
    })


@files_bp.route("/tracking/<post_name>")
@require_admin
def get_tracking(post_name):
    """获取某帖子的追踪记录"""
    limit = request.args.get("limit", 50, type=int)
    conn = _db()
    rows = conn.execute(
        "SELECT id, tracking_code, user_id, user_name, file_name, version, retrieved_at "
        "FROM tracking WHERE post_name = ? ORDER BY retrieved_at DESC LIMIT ?",
        (post_name, limit),
    ).fetchall()
    conn.close()

    return jsonify({
        "post_name": post_name,
        "records": [dict(r) for r in rows],
    })


@files_bp.route("/files/verify-watermark", methods=["POST"])
@require_admin
def verify_watermark():
    """上传文件验证水印"""
    if "file" not in request.files:
        return jsonify({"error": "请上传文件"}), 400

    f = request.files["file"]
    file_bytes = f.read()
    filename = f.filename or ""

    # 根据文件类型提取水印
    tracking_code = None
    if filename.lower().endswith((".png", ".jpg", ".jpeg")):
        tracking_code = _extract_image_watermark(file_bytes)
    elif filename.lower().endswith(".json"):
        tracking_code = _extract_json_watermark(file_bytes)
    else:
        return jsonify({"error": "不支持的文件类型，仅支持 PNG/JPG/JSON"}), 400

    if not tracking_code:
        return jsonify({"found": False, "message": "未检测到水印"})

    # 查询追踪记录
    conn = _db()
    row = conn.execute(
        "SELECT user_id, user_name, post_name, file_name, version, retrieved_at "
        "FROM tracking WHERE tracking_code = ?",
        (tracking_code,),
    ).fetchone()
    conn.close()

    if row:
        return jsonify({
            "found": True,
            "tracking_code": tracking_code,
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "post_name": row["post_name"],
            "file_name": row["file_name"],
            "version": row["version"],
            "retrieved_at": row["retrieved_at"],
        })

    return jsonify({
        "found": False,
        "tracking_code": tracking_code,
        "message": "找到追踪码但无对应记录",
    })


@files_bp.route("/files/<int:file_id>", methods=["DELETE"])
@require_admin
def delete_file(file_id):
    """删除某个文件"""
    conn = _db()
    row = conn.execute("SELECT file_path, post_name, file_name FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "文件不存在"}), 404

    # 删除物理文件
    file_path = row["file_path"]
    if os.path.exists(file_path):
        os.remove(file_path)

    # 删除数据库记录
    conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "deleted": row["file_name"]})
