FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（Pillow 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
COPY web/requirements.txt web/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -r web/requirements.txt

# 复制项目文件
COPY bot.py .
COPY web/ web/

# 复制启动脚本
COPY start.sh .
RUN chmod +x start.sh

# 创建数据目录
RUN mkdir -p /data/files

# 暴露 Flask 端口
EXPOSE 5000

# 启动
CMD ["./start.sh"]
