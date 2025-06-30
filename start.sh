#!/bin/bash

# JUSTScan 启动脚本

echo "🚀 启动 JUSTScan 图片单词卡识别系统..."

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3，请先安装 Python 3.7+"
    exit 1
fi

# 检查依赖是否安装
if [ ! -f "requirements.txt" ]; then
    echo "❌ 错误: 未找到 requirements.txt 文件"
    exit 1
fi

# 安装依赖
echo "📦 安装 Python 依赖..."
pip3 install -r requirements.txt

# 检查配置文件
if [ ! -f "config.py" ]; then
    echo "❌ 错误: 未找到 config.py 文件"
    exit 1
fi

# 启动服务
echo "🎯 启动后端服务..."
python3 run.py 

curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "describe this image"
          },
          {
            "inline_data": {
              "mime_type": "image/jpeg",
              "data": "base64编码的图片内容"
            }
          }
        ]
      }
    ]
  }' \
  "https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent?key=你的API_KEY" 