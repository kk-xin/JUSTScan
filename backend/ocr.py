import os
import base64
import re
from PIL import Image, ImageFilter, ImageOps
from tencentcloud.ocr.v20181119 import ocr_client, models
from tencentcloud.common import credential
from dotenv import load_dotenv

load_dotenv()

SECRET_ID = os.environ.get('TENCENT_SECRET_ID')
SECRET_KEY = os.environ.get('TENCENT_SECRET_KEY')
REGION = os.environ.get('TENCENT_REGION', 'ap-beijing')

cred = credential.Credential(SECRET_ID, SECRET_KEY)
client = ocr_client.OcrClient(cred, REGION)

def preprocess_image(image_bytes):
    temp_path = 'temp_image.jpg'
    with open(temp_path, 'wb') as f:
        f.write(image_bytes)
    img = Image.open(temp_path)
    # 灰度化
    img = img.convert('L')
    # 二值化
    threshold = 150
    img = img.point(lambda p: 255 if p > threshold else 0)
    img = img.convert('1')
    # 锐化
    img = img.filter(ImageFilter.SHARPEN)
    return img, temp_path

def extract_english_words_from_image(image_bytes):
    print("进入OCR识别函数，图片字节长度:", len(image_bytes))
    req = models.EnglishOCRRequest()
    req.ImageBase64 = base64.b64encode(image_bytes).decode()
    resp = client.EnglishOCR(req)
    print("腾讯云OCR原始返回:", resp.to_json_string())
    text_detections = getattr(resp, 'TextDetections', None)
    print("TextDetections内容:", text_detections)
    words = set()
    if not text_detections:
        print("OCR未检测到任何文本")
        return []
    for item in text_detections:
        print("检测到文本:", getattr(item, 'DetectedText', None))
        for word in re.findall(r'[a-zA-Z]{2,}', item.DetectedText):
            words.add(word.lower())
    return sorted(list(words)) 