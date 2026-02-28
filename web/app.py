"""
小鹅子 Bot 管理面板 - Flask 后端入口
"""

import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from auth import auth_bp

app = Flask(__name__, static_folder="frontend", static_url_path="")
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(32).hex())

# CORS：开发时允许前端 dev server 跨域
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ============ 注册蓝图 ============
app.register_blueprint(auth_bp)

# 后续步骤中会在此处注册更多功能蓝图，例如：
# from api_files import files_bp
# app.register_blueprint(files_bp)


# ============ 前端静态文件服务 ============

@app.route("/")
def index():
    """返回前端 SPA 入口页"""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_files(path):
    """其他静态资源，找不到则返回 index.html（SPA 路由）"""
    file_path = os.path.join(app.static_folder, path)
    if os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


# ============ 启动 ============

if __name__ == "__main__":
    port = int(os.getenv("WEB_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
