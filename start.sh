#!/bin/bash

echo "🐧 启动小鹅子管理面板 (Flask)..."
python /app/web/app.py &

echo "🐧 启动小鹅子 Bot..."
exec python /app/bot.py
