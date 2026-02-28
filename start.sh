#!/bin/bash

# 小鹅子 Bot + 管理面板 启动脚本
# 同时运行 Discord Bot 和 Flask Web 服务

echo "🐧 启动小鹅子管理面板 (Flask)..."
cd /app/web && python app.py &
WEB_PID=$!

echo "🐧 启动小鹅子 Bot..."
cd /app && python bot.py &
BOT_PID=$!

# 捕获终止信号，优雅关闭
trap "echo '🐧 收到终止信号，关闭中...'; kill $WEB_PID $BOT_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# 等待任一进程退出
wait -n $WEB_PID $BOT_PID

# 如果有进程退出了，关闭另一个
echo "🐧 检测到进程退出，关闭所有服务..."
kill $WEB_PID $BOT_PID 2>/dev/null
wait
