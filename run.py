#!/usr/bin/env python3
"""
JUSTScan 后端服务启动脚本
"""

import os
import sys
from app import app
from config import Config

def main():
    """主函数"""
    print("=" * 50)
    print("JUSTScan 图片单词卡识别系统")
    print("=" * 50)
    
    # 创建上传目录
    if not os.path.exists(Config.UPLOAD_FOLDER):
        os.makedirs(Config.UPLOAD_FOLDER)
        print(f"✅ 创建上传目录: {Config.UPLOAD_FOLDER}")
    
    print(f"🚀 启动后端服务...")
    print(f"📍 服务地址: http://localhost:5050")
    print(f"🔗 健康检查: http://localhost:5050/health")
    print(f"📁 上传接口: http://localhost:5050/upload")
    print(f"📥 下载接口: http://localhost:5050/download")
    print("=" * 50)
    
    try:
        app.run(
            debug=Config.DEBUG,
            host='0.0.0.0',
            port=5050,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main() 