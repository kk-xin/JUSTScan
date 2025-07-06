from flask_sqlalchemy import SQLAlchemy #导入 Flask-SQLAlchemy 的主类 SQLAlchemy，用于操作数据库
import datetime

db = SQLAlchemy() # 创建一个 SQLAlchemy 数据库对象 db，后续所有的模型类都要继承自它。


class WordBook(db.Model):
    __tablename__ = "wordbooks"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    is_deleted = db.Column(db.Boolean, default=False)
    cards = db.relationship("WordCard", backref="wordbook", lazy=True) #backref='wordbook' 表示在 WordCard 中可以通过 wordcard.wordbook 访问所属的 WordBook。

    def __init__(self, name):
        self.name = name


class WordCard(db.Model):
    __tablename__ = 'word_cards'
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(64), nullable=False)
    word_meaning = db.Column(db.Text)
    word_audio_url = db.Column(db.Text)
    example = db.Column(db.Text)
    example_meaning = db.Column(db.Text)
    example_audio_url = db.Column(db.Text)
    wordbook_id = db.Column(db.Integer, db.ForeignKey('wordbooks.id'), nullable=False)
    is_favorite = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    modify_time = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def __init__(self, word, word_meaning, word_audio_url, example, example_meaning, example_audio_url, wordbook_id):
        self.word = word
        self.word_meaning = word_meaning
        self.word_audio_url = word_audio_url
        self.example = example
        self.example_meaning = example_meaning
        self.example_audio_url = example_audio_url
        self.wordbook_id = wordbook_id
