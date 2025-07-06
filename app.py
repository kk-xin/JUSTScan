from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask import session
import csv
import os
import base64
from tencentcloud.ocr.v20181119 import ocr_client, models
from tencentcloud.common import credential
from PIL import Image, ImageFilter, ImageOps
from config import Config
import re
import requests
import time
from flask_sqlalchemy import SQLAlchemy
import datetime
import pymysql
pymysql.install_as_MySQLdb()
from dotenv import load_dotenv
load_dotenv()
from backend.ocr import extract_english_words_from_image, preprocess_image
from backend.model import db, WordBook, WordCard

# 腾讯云OCR配置
SECRET_ID = os.environ.get('TENCENT_SECRET_ID')
SECRET_KEY = os.environ.get('TENCENT_SECRET_KEY')
REGION = os.environ.get('TENCENT_REGION')


cred = credential.Credential(SECRET_ID, SECRET_KEY)
client = ocr_client.OcrClient(cred, REGION)

#初始化 Flask 和 SQLAlchemy 的绑定
#static_folder='frontend' 告诉 Flask："我的所有静态资源都在 frontend 这个文件夹里。"
#static_url_path='/static' 告诉 Flask："只要浏览器访问 /static/xxx，帮我去 frontend/xxx 找文件。"
#这样可以让前端引用路径统一（/static/xxx），不管你后端怎么存放文件，前端都不用改。
app = Flask(__name__, static_folder='frontend', static_url_path='/static')
app.config.from_object(Config)
db.init_app(app)  # 这行很重要
CORS(app)


def generate_csv(words, filename='words.csv'):
    """生成CSV文件"""
    csv_path = os.path.join(os.getcwd(), filename)
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['单词'])
        for word in words:
            writer.writerow([word])
    return csv_path

@app.route('/')
def serve_index():
    return send_from_directory('frontend/html', 'index.html')

@app.route('/cards')
def serve_cards():
    return send_from_directory('frontend/html', 'cards.html')

@app.route('/favorites')
def serve_favorites():
    return send_from_directory('frontend/html', 'favorites.html')

@app.route('/upload', methods=['POST'])
def upload():
    print("收到/upload上传请求")
    try:
        if 'files' not in request.files:
            print("没有文件上传")
            return jsonify({'error': '没有文件上传'}), 400
        files = request.files.getlist('files')
        if not files:
            print("没有选择文件")
            return jsonify({'error': '没有选择文件'}), 400
        
        all_words = []
        for file in files:
            if file.filename == '':
                continue
            image_bytes = file.read()
            print(f"处理文件: {file.filename}, 大小: {len(image_bytes)} 字节")
            # 用腾讯云OCR识别图片中的英文单词
            words = extract_english_words_from_image(image_bytes)
            print(f"识别到单词: {words}")
            all_words.extend(words)
        
        
        unique_words = sorted(list(set(all_words)))
        
        
        print(f"所有去重后单词: {unique_words}")
        session['unique_words'] = unique_words
        
        # 仍然生成CSV文件作为备份
        generate_csv(unique_words)
        
        return jsonify({
            'success': True,
            'words': unique_words,
            'count': len(unique_words),
            # 'saved_cards': len(word_cards),
            'csv_download_url': '/download'
        })
        
    except Exception as e:
        return jsonify({'error': f'处理失败: {str(e)}'}), 500

@app.route('/download')
def download():
    try:
        csv_path = os.path.join(os.getcwd(), 'words.csv')
        if os.path.exists(csv_path):
            return send_file(
                csv_path,
                as_attachment=True,
                download_name='words.csv',
                mimetype='text/csv'
            )
        else:
            return jsonify({'error': 'CSV文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': f'下载失败: {str(e)}'}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'message': 'JUSTScan后端服务运行正常'})

@app.route('/upload_full_csv', methods=['POST'])
def upload_full_csv():
    try:
        content = request.data.decode('utf-8')
        csv_path = os.path.join(os.getcwd(), 'words_full.csv')
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get_full_csv')
def get_full_csv():
    try:
        csv_path = os.path.join(os.getcwd(), 'words_full.csv')
        if os.path.exists(csv_path):
            # 读取并处理CSV文件
            rows = []
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            # 检查是否需要添加修改时间列
            if len(rows) > 0 and len(rows[0]) < 4:
                # 添加修改时间列到表头
                rows[0].append('修改时间')
                
                # 为现有数据添加默认修改时间
                import datetime
                default_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                for i in range(1, len(rows)):
                    while len(rows[i]) < 4:
                        rows[i].append(default_time)
                
                # 写回文件
                with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerows(rows)
            
            # 返回处理后的内容
            content = ''
            for row in rows:
                content += ','.join(row) + '\n'
            return content, 200, {'Content-Type': 'text/csv'}
        else:
            return '', 404
    except Exception as e:
        return '', 500

@app.route('/init_db')
def init_db():
    db.create_all()
    return '数据库初始化完成'

@app.route('/add_wordbook', methods=['POST'])
def add_wordbook():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'error': '单词本名称不能为空'}), 400
        if WordBook.query.filter_by(name=name).first():
            return jsonify({'success': False, 'error': '单词本已存在'}), 400
        wordbook = WordBook(name=name)
        db.session.add(wordbook)
        db.session.commit()
        print('新建单词本成功:', wordbook.id, wordbook.name)
        return jsonify({'success': True, 'id': wordbook.id})
    except Exception as e:
        print('新建单词本异常:', e)
        return jsonify({'success': False, 'error': str(e)}), 500

# 获取未删除的单词本
@app.route('/get_wordbooks')
def get_wordbooks():
    wordbooks = WordBook.query.filter_by(is_deleted=False).all()
    return jsonify({'wordbooks': [
        {'id': wb.id, 'name': wb.name, 'create_time': wb.create_time.strftime('%Y-%m-%d %H:%M:%S')}
        for wb in wordbooks]})

# 软删除单词本
@app.route('/soft_delete_wordbook', methods=['POST'])
def soft_delete_wordbook():
    data = request.get_json()
    wb_id = data.get('id')
    wb = WordBook.query.get(wb_id)
    if not wb:
        return jsonify({'success': False, 'error': '未找到该单词本'}), 404
    wb.is_deleted = True
    db.session.commit()
    return jsonify({'success': True})

# 获取回收站里的单词本
@app.route('/get_deleted_wordbooks')
def get_deleted_wordbooks():
    wordbooks = WordBook.query.filter_by(is_deleted=True).all()
    return jsonify({'wordbooks': [
        {'id': wb.id, 'name': wb.name, 'create_time': wb.create_time.strftime('%Y-%m-%d %H:%M:%S')}
        for wb in wordbooks]})

# 恢复单词本
@app.route('/restore_wordbook', methods=['POST'])
def restore_wordbook():
    data = request.get_json()
    wb_id = data.get('id')
    wb = WordBook.query.get(wb_id)
    if not wb:
        return jsonify({'success': False, 'error': '未找到该单词本'}), 404
    wb.is_deleted = False
    db.session.commit()
    return jsonify({'success': True})

@app.route('/add_card', methods=['POST'])
def add_card():
    data = request.get_json()
    word = data.get('word', '').strip()
    meaning = data.get('meaning', '').strip()
    example = data.get('example', '').strip()
    wordbook_id = data.get('wordbook_id')
    if not word or not meaning or not example or not wordbook_id:
        return jsonify({'success': False, 'error': '参数不完整'}), 400
    card = WordCard(word=word, word_meaning=meaning, word_audio_url="", example=example, example_meaning="", example_audio_url="", wordbook_id=wordbook_id)
    db.session.add(card)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/get_cards')
def get_cards():
    wordbook_id = request.args.get('wordbook_id', type=int)
    if not wordbook_id:
        return jsonify({'cards': []})
    cards = WordCard.query.filter_by(wordbook_id=wordbook_id, is_deleted=False).all()
    return jsonify({'cards': [
        {'word': c.word, 'meaning': c.meaning, 'example': c.example, 'is_favorite': c.is_favorite, 'modify_time': c.modify_time.strftime('%Y-%m-%d %H:%M:%S')}
        for c in cards
    ]})

@app.route('/update_card', methods=['POST'])
def update_card():
    data = request.get_json()
    word = data.get('word')
    new_word = data.get('new_word', '').strip()
    meaning = data.get('meaning', '').strip()
    example = data.get('example', '').strip()
    wordbook_id = data.get('wordbook_id')
    card = WordCard.query.filter_by(word=word, wordbook_id=wordbook_id).first()
    if not card:
        return jsonify({'success': False, 'error': '未找到该单词卡'}), 404
    if new_word and new_word != word and WordCard.query.filter_by(word=new_word, wordbook_id=wordbook_id).first():
        return jsonify({'success': False, 'error': '新单词已存在'}), 400
    card.word = new_word or word
    card.meaning = meaning
    card.example = example
    db.session.commit()
    return jsonify({'success': True})

@app.route('/soft_delete_card', methods=['POST'])
def soft_delete_card():
    data = request.get_json()
    word = data.get('word')
    wordbook_id = data.get('wordbook_id')
    card = WordCard.query.filter_by(word=word, wordbook_id=wordbook_id).first()
    if not card:
        return jsonify({'success': False, 'error': '未找到该单词卡'}), 404
    card.is_deleted = True
    db.session.commit()
    return jsonify({'success': True})

@app.route('/toggle_favorite', methods=['POST'])
def toggle_favorite():
    data = request.get_json()
    word = data.get('word')
    wordbook_id = data.get('wordbook_id')
    card = WordCard.query.filter_by(word=word, wordbook_id=wordbook_id).first()
    if not card:
        return jsonify({'success': False, 'error': '未找到该单词卡'}), 404
    card.is_favorite = not card.is_favorite
    db.session.commit()
    return jsonify({'success': True, 'is_favorite': card.is_favorite})

@app.route('/get_deleted_cards')
def get_deleted_cards():
    wordbook_id = request.args.get('wordbook_id', type=int)
    if not wordbook_id:
        return jsonify({'cards': []})
    cards = WordCard.query.filter_by(wordbook_id=wordbook_id, is_deleted=True).all()
    return jsonify({'cards': [
        {'word': c.word, 'meaning': c.meaning, 'example': c.example, 'modify_time': c.modify_time.strftime('%Y-%m-%d %H:%M:%S')}
        for c in cards
    ]})

@app.route('/restore_card', methods=['POST'])
def restore_card():
    data = request.get_json()
    word = data.get('word')
    wordbook_id = data.get('wordbook_id')
    card = WordCard.query.filter_by(word=word, wordbook_id=wordbook_id).first()
    if not card:
        return jsonify({'success': False, 'error': '未找到该单词卡'}), 404
    card.is_deleted = False
    db.session.commit()
    return jsonify({'success': True})

@app.route('/get_default_cards')
def get_default_cards():
    """获取默认单词本中的所有单词卡"""
    try:
        wordbook = WordBook.query.filter_by(name='默认单词本').first()
        if not wordbook:
            return jsonify({'cards': []})
        
        cards = WordCard.query.filter_by(wordbook_id=wordbook.id, is_deleted=False).all()
        return jsonify({'cards': [
            {
                'word': c.word, 
                'meaning': c.meaning, 
                'example': c.example, 
                'is_favorite': c.is_favorite, 
                'modify_time': c.modify_time.strftime('%Y-%m-%d %H:%M:%S')
            }
            for c in cards
        ]})
    except Exception as e:
        return jsonify({'error': f'获取单词卡失败: {str(e)}'}), 500

@app.route('/generate_cards', methods=['POST'])
def generate_cards():
    """
    接收unique_words，组装prompt请求Gemini，解析返回内容并存入word_cards表。
    """
    try:
        data = request.get_json()
        unique_words = data.get('unique_words', [])
        wordbook_id = data.get('wordbook_id')  # 前端传入单词本id
        if not unique_words or not wordbook_id:
            return jsonify({'success': False, 'error': '参数不完整'}), 400

        # 组装prompt，要求用|||分隔
        prompt = """
请严格按照如下格式输出，每个字段用"|||"分隔：单词|||词性. 中文释义|||英文例句（句子要高级且不少于15个单词）|||例句中文翻译。
比如：
apple|||n. 苹果（水果）|||She ate an apple every morning to maintain a healthy lifestyle and boost her immune system.|||她每天早上吃一个苹果以保持健康的生活方式并增强免疫系统。
run|||vi. 跑步，奔跑；vt. 经营，管理|||He runs a successful business while also running every morning to stay fit.|||他经营着一家成功的企业，同时每天早上跑步保持健康。
请为以下单词生成内容：\n""" + "\n".join(unique_words)

        # 调用Gemini
        gemini_api_url = app.config.get('GEMINI_API_URL') or 'http://localhost:8000/chat'
        gemini_response = requests.post(gemini_api_url, json={'prompt': prompt}, timeout=60)
        if gemini_response.status_code != 200:
            return jsonify({'success': False, 'error': f'Gemini API调用失败: {gemini_response.status_code}'}), 500
        result = gemini_response.json()
        if 'reply' not in result:
            return jsonify({'success': False, 'error': 'Gemini无返回内容'}), 500
        reply = result['reply']

        
        # 解析Gemini返回内容，按|||分割
        lines = reply.strip().split('\n')
        saved_cards = 0
        for line in lines:
            if not line.strip():
                continue
            parts = line.split('|||')
            print(parts, flush=True)
            if len(parts) == 4:
             
                word = parts[0].strip()
                word_meaning = parts[1].strip()
                example = parts[2].strip()
                example_meaning = parts[3].strip()
                word_audio_url = ""
                example_audio_url = ""
           
                existing_card = WordCard.query.filter_by(word=word, wordbook_id=wordbook_id).first()
                if not existing_card:
                    card = WordCard(
                        word=word,
                        word_meaning=f"{word_meaning}",
                        word_audio_url=word_audio_url,
                        example=example,
                        example_meaning=example_meaning,
                        example_audio_url=example_audio_url,
                        wordbook_id=wordbook_id
                    )
                    db.session.add(card)
                    saved_cards += 1
        db.session.commit()
        return jsonify({'success': True, 'saved_cards': saved_cards})
    except Exception as e:
        return jsonify({'success': False, 'error': f'生成单词卡失败: {str(e)}'}), 500

@app.route('/get_words')
def get_words():
    try:
        cards = WordCard.query.filter_by(is_deleted=False).all()
        data = [
            {
                'word': c.word,
                'meaning': c.word_meaning,
                'example': c.example,
                'example_meaning': c.example_meaning,
                'is_favorite': c.is_favorite,
                'modify_time': c.modify_time.strftime('%Y-%m-%d %H:%M:%S') if c.modify_time else '',
                'wordbook_id': c.wordbook_id
            }
            for c in cards
        ]
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    print("启动JUSTScan后端服务...")
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5050)

print(os.path.exists('frontend/html/index.html')) 