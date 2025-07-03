from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
import pymysql
from fastapi.responses import JSONResponse
from datetime import date
import pytesseract
from PIL import Image
import io
from tencentcloud.common import credential
from tencentcloud.ocr.v20181119 import ocr_client, models
import base64
import requests

# 加载环境变量
load_dotenv()

# 配置 Gemini API Key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    print("警告: 未设置GOOGLE_API_KEY环境变量，请设置有效的API密钥")
    GOOGLE_API_KEY = "your-api-key-here"  # 请替换为您的实际API密钥

genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI()

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str

class WordItem(BaseModel):
    word: str
    definition: str
    example: str

try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    print("Gemini模型初始化成功")
except Exception as e:
    print(f"Gemini模型初始化失败: {e}")
    model = None

@app.post("/chat")
async def chat_endpoint(chat: ChatRequest):
    if not model:
        return {"error": "Gemini模型未正确初始化，请检查API密钥配置"}
    
    
    try:
        prompt = chat.prompt
        response = model.generate_content(prompt)
        return {"reply": response.text}
    except Exception as e:
        print("Gemini调用异常：", e, flush=True)
        return {"error": f"调用Gemini API失败: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Gemini API服务运行正常"}

@app.post("/save_words")
async def save_words_endpoint(items: list[WordItem]):
    # 连接数据库
    connection = pymysql.connect(
        host='127.0.0.1',
        port=3306,
        user='root',
        password='12345678',
        database='justscan',
        charset='utf8mb4'
    )
    try:
        with connection.cursor() as cursor:
            for item in items:
                sql = "INSERT INTO words (word, definition, example, upload_date) VALUES (%s, %s, %s, %s)"
                cursor.execute(sql, (item.word, item.definition, item.example, date.today()))
        connection.commit()
        return {"success": True, "message": f"已写入{len(items)}条数据"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        connection.close()

@app.get("/get_words")
async def get_words():
    connection = pymysql.connect(
        host='127.0.0.1',
        port=3306,
        user='root',
        password='12345678',
        database='justscan',
        charset='utf8mb4'
    )
    try:
        with connection.cursor() as cursor:
            sql = "SELECT word, definition, example, upload_date FROM words"
            cursor.execute(sql)
            rows = cursor.fetchall()
            result = [{"word": row[0], "definition": row[1], "example": row[2], "upload_date": row[3].strftime('%Y-%m-%d') if row[3] else ''} for row in rows]
        return JSONResponse(content={"success": True, "data": result})
    except Exception as e:
        return JSONResponse(content={"success": False, "error": str(e)})
    finally:
        connection.close()

@app.post("/upload")
async def upload_image(files: list[UploadFile] = File(...)):
    # 这里原本有百度OCR密钥相关判断，现已删除
    # 请在此处集成腾讯云OCR或其他你需要的逻辑
    words = []
    for file in files:
        content = await file.read()
        # 这里可以调用腾讯云OCR识别图片内容并提取单词
        # 示例：words.extend(tencent_ocr_extract_words(content))
    return {"success": True, "count": len(words), "words": words} 