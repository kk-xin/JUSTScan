# JUSTScan - 智能图片单词卡识别系统

JUSTScan 是一个图片文字识别系统，能够自动识别图片中的英文单词并生成单词卡。

## ✨ 功能特性

- 🖼️ **智能图片识别**: 识别图片中的英文单词
- 📝 **自动单词提取**: 自动提取和去重识别到的单词
- 📊 **CSV导出**: 生成包含单词的CSV文件
- 🎨 **现代化UI**: 美观的响应式界面设计
- 📱 **移动端适配**: 完美支持手机和平板设备
- ⚡ **实时处理**: 支持多图片批量上传和实时处理

## 🚀 快速开始

### 环境要求

- Python 3.7+

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd JUSTScan
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

3. **启动后端服务**
```bash
python run.py
```

4. **打开前端页面**
   在浏览器中打开 `index.html` 文件

## 🔧 使用说明

1. **上传图片**
   - 点击"上传图片"按钮或拖拽图片到上传区域
   - 支持 JPG、PNG、GIF、BMP、WebP 格式
   - 可同时上传多张图片

2. **查看识别结果**
   - 系统自动识别图片中的英文单词
   - 在单词卡区域显示识别结果
   - 支持编辑和删除单词卡

3. **导出CSV**
   - 点击"导出单词卡"按钮
   - 自动下载包含单词的CSV文件（words.csv）

4. **生成释义和例句（手动操作）**
   - 打开 [Gemini网页版](https://gemini.google.com/) 或 [Google AI Studio](https://aistudio.google.com/app/prompts)
   - 复制 words.csv 中的所有单词，粘贴到 Gemini 对话框
   - 使用如下提示词：
     ```
     请严格按照如下格式输出：单词,中文释义,英文例句。比如：
     apple,苹果,She ate an apple every morning.
     banana,香蕉,The monkey likes to eat bananas.
     请为以下单词生成内容：
     orange
grape
     ```
   - 将生成的内容复制，粘贴到 words_full.csv 文件中

## 📁 项目结构

```
JUSTScan/
├── app.py              # Flask后端主程序
├── config.py           # 配置文件
├── run.py              # 启动脚本
├── requirements.txt    # Python依赖
├── index.html          # 前端页面
├── styles.css          # 样式文件
├── script.js           # 前端脚本
└── README.md           # 项目说明
```

## 🐛 故障排除

- 确保图片清晰可读
- 检查图片格式是否支持
- 检查端口是否被占用
- 确保Python版本兼容

## 📄 许可证

本项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者

---

**JUSTScan** - 让单词学习更简单！ 🎓 