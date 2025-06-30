from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
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

# 腾讯云OCR配置
SECRET_ID = os.environ.get('TENCENT_SECRET_ID')
SECRET_KEY = os.environ.get('TENCENT_SECRET_KEY')
REGION = os.environ.get('TENCENT_REGION')


cred = credential.Credential(SECRET_ID, SECRET_KEY)
client = ocr_client.OcrClient(cred, REGION)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db = SQLAlchemy(app)

# 单词本模型
class WordBook(db.Model):
    __tablename__ = 'wordbooks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    cards = db.relationship('WordCard', backref='wordbook', lazy=True)
    def __init__(self, name):
        self.name = name

# 单词卡模型
class WordCard(db.Model):
    __tablename__ = 'word_cards'
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(64), nullable=False)
    meaning = db.Column(db.Text)
    example = db.Column(db.Text)
    wordbook_id = db.Column(db.Integer, db.ForeignKey('wordbooks.id'), nullable=False)
    is_favorite = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    modify_time = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    def __init__(self, word, meaning, example, wordbook_id):
        self.word = word
        self.meaning = meaning
        self.example = example
        self.wordbook_id = wordbook_id

def generate_csv(words, filename='words.csv'):
    """生成CSV文件"""
    csv_path = os.path.join(os.getcwd(), filename)
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['单词'])
        for word in words:
            writer.writerow([word])
    return csv_path

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
        
        # 调用Gemini API生成词义和例句
        word_cards = []
        for word in unique_words:
            try:
                # 调用Gemini API
                import requests
                gemini_response = requests.post('http://localhost:8000/chat', 
                                             json={'text': word}, 
                                             timeout=30)
                
                if gemini_response.status_code == 200:
                    result = gemini_response.json()
                    if 'reply' in result:
                        # 解析Gemini返回的内容
                        lines = result['reply'].strip().split('\n')
                        for line in lines:
                            if ',' in line and word.lower() in line.lower():
                                parts = line.split(',', 2)  # 最多分割2次
                                if len(parts) >= 3:
                                    detected_word = parts[0].strip()
                                    meaning = parts[1].strip()
                                    example = parts[2].strip()
                                    
                                    # 保存到数据库
                                    wordbook = WordBook.query.filter_by(name='默认单词本').first()
                                    if not wordbook:
                                        wordbook = WordBook(name='默认单词本')
                                        db.session.add(wordbook)
                                        db.session.commit()
                                    
                                    # 检查是否已存在
                                    existing_card = WordCard.query.filter_by(
                                        word=detected_word, 
                                        wordbook_id=wordbook.id
                                    ).first()
                                    
                                    if not existing_card:
                                        card = WordCard(
                                            word=detected_word,
                                            meaning=meaning,
                                            example=example,
                                            wordbook_id=wordbook.id
                                        )
                                        db.session.add(card)
                                        word_cards.append({
                                            'word': detected_word,
                                            'meaning': meaning,
                                            'example': example
                                        })
                                    
                                    break  # 找到匹配的单词就跳出
                else:
                    print(f"Gemini API调用失败: {gemini_response.status_code}")
                    
            except Exception as e:
                print(f"处理单词 {word} 时出错: {str(e)}")
                continue
        
        db.session.commit()
        
        # 仍然生成CSV文件作为备份
        generate_csv(unique_words)
        
        return jsonify({
            'success': True,
            'words': unique_words,
            'count': len(unique_words),
            'saved_cards': len(word_cards),
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
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '单词本名称不能为空'}), 400
    if WordBook.query.filter_by(name=name).first():
        return jsonify({'success': False, 'error': '单词本已存在'}), 400
    wordbook = WordBook(name=name)
    db.session.add(wordbook)
    db.session.commit()
    return jsonify({'success': True, 'id': wordbook.id})

@app.route('/get_wordbooks')
def get_wordbooks():
    wordbooks = WordBook.query.all()
    return jsonify({'wordbooks': [{'id': wb.id, 'name': wb.name, 'create_time': wb.create_time.strftime('%Y-%m-%d %H:%M:%S')} for wb in wordbooks]})

@app.route('/add_card', methods=['POST'])
def add_card():
    data = request.get_json()
    word = data.get('word', '').strip()
    meaning = data.get('meaning', '').strip()
    example = data.get('example', '').strip()
    wordbook_id = data.get('wordbook_id')
    if not word or not meaning or not example or not wordbook_id:
        return jsonify({'success': False, 'error': '参数不完整'}), 400
    card = WordCard(word=word, meaning=meaning, example=example, wordbook_id=wordbook_id)
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

if __name__ == '__main__':
    print("启动JUSTScan后端服务...")
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5050) 