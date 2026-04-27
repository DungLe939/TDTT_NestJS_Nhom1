import json
import re
import base64
import sys
import time
from google import generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore

# Đảm bảo in ra màn hình không bị lỗi font Tiếng Việt trên Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def get_env_var(key):
    try:
        with open("../../.env", "r", encoding="utf-8") as f: 
            for line in f:
                if line.startswith(f"{key}="):
                    return line.strip().split("=", 1)[1].strip('"')
    except:
        return None
    return None

# 1. Cấu hình Gemini
GEMINI_KEY = get_env_var("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_KEY)

available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
target_model = 'models/gemini-1.5-flash'
if target_model not in available_models:
    flash_models = [m for m in available_models if 'flash' in m]
    target_model = flash_models[0] if flash_models else available_models[0]

print(f"--- Su dung Model: {target_model} ---")
model = genai.GenerativeModel(target_model.replace('models/', ''))

# 2. Cấu hình Firebase
FIREBASE_CONFIG = {
    "type": "service_account",
    "project_id": get_env_var("FIREBASE_PROJECT_ID"),
    "private_key": get_env_var("FIREBASE_PRIVATE_KEY").replace("\\n", "\n") if get_env_var("FIREBASE_PRIVATE_KEY") else None,
    "client_email": get_env_var("FIREBASE_CLIENT_EMAIL"),
    "token_uri": "https://oauth2.googleapis.com/token",
}

if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CONFIG)
    firebase_admin.initialize_app(cred)
db = firestore.client()

def process_chunk(lines_chunk):
    raw_text = "\n".join(lines_chunk)
    prompt = f"Trích xuất tên món ăn cụ thể và dịch sang tiếng Anh. Trả về JSON: {{\"vi\": \"en\"}}. Danh sách:\n{raw_text}"
    
    try:
        response = model.generate_content(prompt)
        clean_json = re.search(r'\{.*\}', response.text, re.DOTALL).group()
        translations = json.loads(clean_json)
        
        batch = db.batch()
        count = 0
        for vi, en in translations.items():
            doc_id = base64.b64encode(vi.encode()).decode().replace('/', '_').replace('+', '-').replace('=', '')
            batch.set(db.collection('rag_dictionary').document(doc_id), {
                'vi': vi, 'en': en, 'updatedAt': firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"OK: {vi} -> {en}".encode('ascii', 'ignore').decode('ascii'))
            count += 1
        batch.commit()
        return count
    except Exception as e:
        print(f"Loi xu ly chunk: {e}")
        return 0

def main():
    print("--- BAT DAU QUY TRINH DONG BO DU LIEU TOAN DIEN ---")
    try:
        with open("crawled_dishes.txt", "r", encoding="utf-8") as f:
            all_lines = [l.strip() for l in f.readlines() if l.strip()]
        if not all_lines:
            print("File trong!")
            return
    except:
        print("Khong tim thay file crawled_dishes.txt")
        return

    print(f"Tim thay tong cong {len(all_lines)} dong du lieu.")
    
    # Chia nho du lieu ra moi lan 40 dong de AI xu ly tot nhat
    chunk_size = 40
    total_synced = 0
    for i in range(0, len(all_lines), chunk_size):
        chunk = all_lines[i:i + chunk_size]
        print(f"\n--- Dang xu ly nhom {i//chunk_size + 1} ({len(chunk)} dong) ---")
        total_synced += process_chunk(chunk)
        time.sleep(2) # Nghi 2 giay de tranh bi gioi han API
        
    print(f"\n--- HOAN THANH! Tong cong da bom {total_synced} mon len Firebase ---")

if __name__ == "__main__":
    main()
