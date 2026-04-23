import os
import sys
import json
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
from sentence_transformers import SentenceTransformer, util
import warnings
warnings.filterwarnings('ignore')

# Fix Windows encoding cho tiếng Việt
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# === CẤU HÌNH ===
cache_dir = "D:/baitap/TuDuyTinhToan/models_cache"
en2vi_model = "vinai/vinai-translate-en2vi"
vi2en_model = "vinai/vinai-translate-vi2en"  # ← THÊM MODEL VI→EN

print("Loading VinAI models...", file=sys.stderr)

# Load EN→VI
tokenizer_en2vi = AutoTokenizer.from_pretrained(en2vi_model, src_lang="en_XX", cache_dir=cache_dir)
model_en2vi = AutoModelForSeq2SeqLM.from_pretrained(en2vi_model, cache_dir=cache_dir)

# Load VI→EN
tokenizer_vi2en = AutoTokenizer.from_pretrained(vi2en_model, src_lang="vi_VN", cache_dir=cache_dir)
model_vi2en = AutoModelForSeq2SeqLM.from_pretrained(vi2en_model, cache_dir=cache_dir)

# Load RAG + Sentiment
search_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
classifier = pipeline("text-classification", model="wonrax/phobert-base-vietnamese-sentiment")

def load_knowledge():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, 'knowledge_base.json')
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                return {}
            return json.loads(content)
    except (json.JSONDecodeError, Exception) as e:
        print(f"Warning: Could not load knowledge_base.json: {e}", file=sys.stderr)
        return {}

data = load_knowledge()
english_keys = list(data.keys())
knowledge_embeddings = search_model.encode(english_keys, convert_to_tensor=True) if english_keys else None

# === HÀM DỊCH ===
def translate_en2vi(en_text):
    """Dịch English → Vietnamese"""
    inputs = tokenizer_en2vi(en_text, return_tensors="pt", padding=True, truncation=True, max_length=1024)
    outputs = model_en2vi.generate(
        **inputs,
        decoder_start_token_id=tokenizer_en2vi.lang_code_to_id["vi_VN"],
        num_return_sequences=1,
        num_beams=5,
        early_stopping=True,
        max_length=3000
    )
    return tokenizer_en2vi.decode(outputs[0], skip_special_tokens=True)

def translate_vi2en(vi_text):
    """Dịch Vietnamese → English"""
    inputs = tokenizer_vi2en(vi_text, return_tensors="pt", padding=True, truncation=True, max_length=1024)
    outputs = model_vi2en.generate(
        **inputs,
        decoder_start_token_id=tokenizer_vi2en.lang_code_to_id["en_XX"],
        num_return_sequences=1,
        num_beams=5,
        early_stopping=True,
        max_length=3000
    )
    return tokenizer_vi2en.decode(outputs[0], skip_special_tokens=True)

# === HÀM CHÍNH ===
def smart_tourism_ai(user_input, method='en2vi'):
    final_text = ""
    rag_matched = False
    
    # Bước 1: TRA RAG
    if knowledge_embeddings is not None and method == 'en2vi':
        user_vec = search_model.encode(user_input, convert_to_tensor=True)
        hits = util.semantic_search(user_vec, knowledge_embeddings, top_k=1)
        if hits[0][0]['score'] > 0.8:
            final_text = data[english_keys[hits[0][0]['corpus_id']]]
            rag_matched = True
    
    # Bước 2: DỊCH BẰNG VINAI
    if not final_text:
        if method == 'en2vi':
            final_text = translate_en2vi(user_input)
        elif method == 'vi2en':
            final_text = translate_vi2en(user_input)
    
    # Bước 3: PHÂN TÍCH CẢM XÚC (nếu là VI)
    sentiment = None
    if method == 'en2vi':
        try:
            analysis = classifier(final_text)[0]
            sentiment = {
                "label": analysis['label'],
                "score": round(analysis['score'], 2)
            }
        except:
            sentiment = None
    
    return {
        "input": user_input,
        "output": final_text,
        "method": "RAG" if rag_matched else "VinAI",
        "sentiment": sentiment
    }

# === MAIN - ĐỌC TỪ STDIN ===
if __name__ == "__main__":
    for line in sys.stdin:
        try:
            data_input = json.loads(line.strip())
            result = smart_tourism_ai(
                data_input.get("text", ""),
                data_input.get("method", "en2vi")
            )
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()