import os
import sys
import json
import re
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
TRANSLATION_DEVICE = os.getenv("TRANSLATION_DEVICE", "cpu")
TRANSLATION_NUM_BEAMS = int(os.getenv("TRANSLATION_NUM_BEAMS", "1"))
TRANSLATION_MAX_NEW_TOKENS = int(os.getenv("TRANSLATION_MAX_NEW_TOKENS", "512"))
TRANSLATION_ENABLE_SENTIMENT = os.getenv("TRANSLATION_ENABLE_SENTIMENT", "false").lower() == "true"
TRANSLATION_SENTIMENT_MAX_CHARS = int(os.getenv("TRANSLATION_SENTIMENT_MAX_CHARS", "300"))

if TRANSLATION_DEVICE == "cuda" and not torch.cuda.is_available():
    print("[Python] WARNING: CUDA is requested but not available. Falling back to CPU.", file=sys.stderr)
    TRANSLATION_DEVICE = "cpu"

print("[Python] Bắt đầu load tất cả models...", file=sys.stderr)

try:
    # Tối ưu hóa bộ nhớ và tốc độ với FP16 nếu dùng CUDA
    torch_dtype = torch.float16 if TRANSLATION_DEVICE == "cuda" else torch.float32

    # Load EN→VI
    print(f"[Python] Loading EN→VI model on {TRANSLATION_DEVICE} with {torch_dtype}...", file=sys.stderr)
    tokenizer_en2vi = AutoTokenizer.from_pretrained(en2vi_model, src_lang="en_XX", cache_dir=cache_dir)
    model_en2vi = AutoModelForSeq2SeqLM.from_pretrained(en2vi_model, cache_dir=cache_dir, torch_dtype=torch_dtype)
    model_en2vi.eval()
    model_en2vi.to(TRANSLATION_DEVICE)
    print("[Python] ✓ EN→VI model loaded", file=sys.stderr)

    # Load VI→EN
    print(f"[Python] Loading VI→EN model on {TRANSLATION_DEVICE} with {torch_dtype}...", file=sys.stderr)
    tokenizer_vi2en = AutoTokenizer.from_pretrained(vi2en_model, src_lang="vi_VN", cache_dir=cache_dir)
    model_vi2en = AutoModelForSeq2SeqLM.from_pretrained(vi2en_model, cache_dir=cache_dir, torch_dtype=torch_dtype)
    model_vi2en.eval()
    model_vi2en.to(TRANSLATION_DEVICE)
    print("[Python] ✓ VI→EN model loaded", file=sys.stderr)

    # Load RAG
    print("[Python] Loading RAG model...", file=sys.stderr)
    search_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    print("[Python] ✓ RAG model loaded", file=sys.stderr)

    # Load Sentiment
    classifier = None
    if TRANSLATION_ENABLE_SENTIMENT:
        print("[Python] Loading Sentiment model...", file=sys.stderr)
        classifier = pipeline("text-classification", model="wonrax/phobert-base-vietnamese-sentiment")
        print("[Python] ✓ Sentiment model loaded", file=sys.stderr)

    # Signal ready
    print(json.dumps({"type": "READY", "message": "All models loaded successfully"}, ensure_ascii=False))
    sys.stdout.flush()
    print("[Python] ✓ Ready signal sent!", file=sys.stderr)

except Exception as e:
    error_msg = f"[Python] ✗ Model loading failed: {str(e)}"
    print(error_msg, file=sys.stderr)
    print(json.dumps({"type": "ERROR", "message": str(e)}, ensure_ascii=False))
    sys.stdout.flush()
    sys.exit(1)

def load_knowledge():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # FIX: Ép buộc luôn trỏ về thư mục src thay vì dist của NestJS
    if 'dist' in current_dir:
        current_dir = current_dir.replace('dist', 'src')
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

def save_knowledge(new_data):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # FIX: Ép buộc luôn trỏ về thư mục src thay vì dist của NestJS
    if 'dist' in current_dir:
        current_dir = current_dir.replace('dist', 'src')
    file_path = os.path.join(current_dir, 'knowledge_base.json')
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Warning: Could not save knowledge_base.json: {e}", file=sys.stderr)

data = load_knowledge()
vi_keys = list(data.keys())
en_keys = list(data.values())
knowledge_embeddings_vi = search_model.encode(vi_keys, convert_to_tensor=True) if vi_keys else None
knowledge_embeddings_en = search_model.encode(en_keys, convert_to_tensor=True) if en_keys else None

def update_rag(vietnamese_name, english_name):
    global data, vi_keys, en_keys, knowledge_embeddings_vi, knowledge_embeddings_en
    if vietnamese_name not in data:
        data[vietnamese_name] = english_name
        save_knowledge(data)
        vi_keys = list(data.keys())
        en_keys = list(data.values())
        # Re-encode toàn bộ keys khi có món mới
        knowledge_embeddings_vi = search_model.encode(vi_keys, convert_to_tensor=True)
        knowledge_embeddings_en = search_model.encode(en_keys, convert_to_tensor=True)


# === HÀM DỊCH ===
def _generate_translation(model, tokenizer, text, target_lang):
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=1024)
    inputs = {k: v.to(TRANSLATION_DEVICE) for k, v in inputs.items()}
    max_new_tokens = min(TRANSLATION_MAX_NEW_TOKENS, max(64, int(inputs["input_ids"].shape[1] * 2.0)))
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            decoder_start_token_id=tokenizer.lang_code_to_id[target_lang],
            num_return_sequences=1,
            num_beams=TRANSLATION_NUM_BEAMS,
            early_stopping=True,
            max_new_tokens=max_new_tokens,
        )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

def translate_en2vi(en_text):
    """Dịch English → Vietnamese"""
    return _generate_translation(model_en2vi, tokenizer_en2vi, en_text, "vi_VN")

def translate_vi2en(vi_text):
    """Dịch Vietnamese → English"""
    return _generate_translation(model_vi2en, tokenizer_vi2en, vi_text, "en_XX")

# === HÀM CHÍNH ===
def smart_tourism_ai(user_input, method='en2vi'):
    lines = user_input.split('\n')
    translated_lines = []
    any_rag_matched = False

    # Thiết lập biến theo chiều dịch
    if method == 'vi2en':
        source_keys = vi_keys
        target_keys = en_keys
        embeddings = knowledge_embeddings_vi
        translate_fallback = translate_vi2en
    else: # en2vi
        source_keys = en_keys
        target_keys = vi_keys
        embeddings = knowledge_embeddings_en
        translate_fallback = translate_en2vi

    for line in lines:
        if not line.strip():
            translated_lines.append("")
            continue
            
        # Regex SIÊU MẠNH: Tách tên món và mọi loại giá (VND, vnđ, k, đ, ₫) & hỗ trợ nhiều mức giá đứng cạnh nhau (15k 20k)
        price_pattern = r'^(.*?)\s*((?:[\d.,]+\s*(?:[kKđĐ₫]|vnd|vnđ|VND|VNĐ)?\s*[-/]?\s*)+)$'
        match = re.match(price_pattern, line, flags=re.IGNORECASE)
        if match:
            item_name = match.group(1).strip()
            item_name = re.sub(r'[\.\-\s]+$', '', item_name)
            item_name = re.sub(r'^[-\s]+', '', item_name)  # Xoa dau '-' va khoang trang o dau
            price = match.group(2).strip()
        else:
            item_name = line.strip()
            item_name = re.sub(r'[\.\-\s]+$', '', item_name)
            item_name = re.sub(r'^[-\s]+', '', item_name)  # Xoa dau '-' va khoang trang o dau
            price = ""
            
        if not item_name:
            translated_lines.append(price)
            continue

        # --- BỘ LỌC THÔNG MINH (Chống rác Database) ---
        is_noise_or_address = False
        lower_name = item_name.lower()
        # 1. Lọc địa chỉ & Thông tin liên hệ (Website, Hotline, LTD, CO...)
        noise_keywords = [
            'phường', 'quận', 'đường', 'tp.', 'thành phố', 
            'ltd', 'co.', 'company', 'corp', 'hotline', 'tel:', 'đt:',
            'website', 'www.', '.com', '.vn', '.net', 'facebook', 'fb.com'
        ]
        
        # 2. Bo dieu kien is_all_caps - nhieu menu Viet Nam viet hoa toan bo nhung van la mon an that
        # is_all_caps bi xoa de khong bo qua nhung dong nhu "CA PHE DEN", "TRA SUA"...

        if any(kw in lower_name for kw in noise_keywords) or re.search(r'\b[pq]\d+\b', lower_name) or lower_name.count('/') >= 2:
            is_noise_or_address = True
            
        # 3. Lọc SĐT (quá ít chữ cái, nhiều số/kí tự đặc biệt)
        if not is_noise_or_address:
            letters_only = re.sub(r'[^a-zA-Z\u00C0-\u1EF9]', '', item_name)
            if len(letters_only) < 3 and len(item_name) >= 5:
                is_noise_or_address = True
        
        # Nếu là địa chỉ/SĐT, giữ nguyên không dịch, không đưa vào RAG
        if is_noise_or_address:
            translated_lines.append(f"{item_name} {price}".strip())
            continue
        # -----------------------------------------------

        translated_name = ""
        
        # Bước 1.1: Exact Match (Khớp chính xác 100%)
        lower_item_name = item_name.lower()
        for i, s_key in enumerate(source_keys):
            if lower_item_name == s_key.lower():
                translated_name = target_keys[i]
                any_rag_matched = True
                break
                
        # Bước 1.2: Tra cứu RAG
        if not translated_name and embeddings is not None and len(source_keys) > 0:
            user_vec = search_model.encode(item_name, convert_to_tensor=True)
            hits = util.semantic_search(user_vec, embeddings, top_k=1)
            # Threshold 0.93 - can bang giua chinh xac va toc do
            if hits and len(hits[0]) > 0 and hits[0][0]['score'] > 0.93:
                translated_name = target_keys[hits[0][0]['corpus_id']]
                any_rag_matched = True
        
        # Bước 2: Dịch Fallback
        if not translated_name:
            translated_name = translate_fallback(item_name)
            # Chong ao giac (Hallucination) cua VinAI - chi check cac tu khoa vo nghia
            # KHONG reset ve tieng Viet chi vi co dau '- ' o dau
            translated_name = re.sub(r'^[-\s]+', '', translated_name).strip()  # Xoa dau '-' neu co
            if translated_name.lower() in ['hi', 'hello', 'hi there', 'yes', 'no', '']:
                translated_name = item_name
                
            # Tự động học (chỉ áp dụng nếu chuỗi ngắn < 50 chars để tránh lưu cả câu chat vào db)
            if len(item_name) < 50:
                if method == 'vi2en':
                    update_rag(item_name, translated_name)
                else:
                    update_rag(translated_name, item_name)
            
        # Bước 3: Ghép Tên và Giá lại
        final_line = f"{translated_name} {price}".strip()
        translated_lines.append(final_line)

    final_text = '\n'.join(translated_lines)
    
    # Bước 4: PHÂN TÍCH CẢM XÚC (nếu là en2vi - khách chat)
    sentiment = None
    if method == 'en2vi' and classifier is not None and len(final_text) <= TRANSLATION_SENTIMENT_MAX_CHARS:
        try:
            analysis = classifier(final_text)[0]
            sentiment = {"label": analysis['label'], "score": round(analysis['score'], 2)}
        except Exception:
            pass
            
    return {
        "input": user_input,
        "output": final_text,
        "method": "RAG" if any_rag_matched else "VinAI",
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
