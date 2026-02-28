#!/bin/bash

echo "🐧 启动小鹅子管理面板 (Flask)..."
python /app/web/app.py 2>&1 &

sleep 2
echo "🐧 Flask 进程状态："
jobs -l

echo "🐧 启动小鹅子 Bot..."
exec python /app/bot.py
