import os
import sys
import json
import re
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from sentence_transformers import SentenceTransformer, util
import warnings
warnings.filterwarnings('ignore')

# ==============================================================================
# CẤU HÌNH MÔI TRƯỜNG
# ==============================================================================
# Fix Windows encoding cho tiếng Việt
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

cache_dir = "D:/baitap/TuDuyTinhToan/models_cache"
en2vi_model = "vinai/vinai-translate-en2vi"
vi2en_model = "vinai/vinai-translate-vi2en"
TRANSLATION_DEVICE = os.getenv("TRANSLATION_DEVICE", "cpu")
TRANSLATION_NUM_BEAMS = int(os.getenv("TRANSLATION_NUM_BEAMS", "1"))
TRANSLATION_MAX_NEW_TOKENS = int(os.getenv("TRANSLATION_MAX_NEW_TOKENS", "512"))

if TRANSLATION_DEVICE == "cuda" and not torch.cuda.is_available():
    print("[Python] WARNING: CUDA requested but not available. Falling back to CPU.", file=sys.stderr)
    TRANSLATION_DEVICE = "cpu"

# ==============================================================================
# KHỞI TẠO MODELS
# Chỉ load 3 model: VinAI EN→VI, VinAI VI→EN, và RAG SentenceTransformer.
# Model PhoBERT Sentiment đã bị xóa để tiết kiệm RAM và tăng tốc khởi động.
# ==============================================================================
print("[Python] Bat dau load tat ca models...", file=sys.stderr)

try:
    torch_dtype = torch.float16 if TRANSLATION_DEVICE == "cuda" else torch.float32

    # --- Model 1: VinAI EN→VI ---
    print(f"[Python] Loading EN→VI model on {TRANSLATION_DEVICE}...", file=sys.stderr)
    tokenizer_en2vi = AutoTokenizer.from_pretrained(en2vi_model, src_lang="en_XX", cache_dir=cache_dir)
    model_en2vi = AutoModelForSeq2SeqLM.from_pretrained(en2vi_model, cache_dir=cache_dir, torch_dtype=torch_dtype)
    model_en2vi.eval()
    model_en2vi.to(TRANSLATION_DEVICE)
    print("[Python] ✓ EN→VI model loaded", file=sys.stderr)

    # --- Model 2: VinAI VI→EN ---
    print(f"[Python] Loading VI→EN model on {TRANSLATION_DEVICE}...", file=sys.stderr)
    tokenizer_vi2en = AutoTokenizer.from_pretrained(vi2en_model, src_lang="vi_VN", cache_dir=cache_dir)
    model_vi2en = AutoModelForSeq2SeqLM.from_pretrained(vi2en_model, cache_dir=cache_dir, torch_dtype=torch_dtype)
    model_vi2en.eval()
    model_vi2en.to(TRANSLATION_DEVICE)
    print("[Python] ✓ VI→EN model loaded", file=sys.stderr)

    # --- Model 3: RAG (Semantic Search) ---
    print("[Python] Loading RAG model...", file=sys.stderr)
    search_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    print("[Python] ✓ RAG model loaded", file=sys.stderr)

    # Signal cho NestJS biết Python đã sẵn sàng
    print(json.dumps({"type": "READY", "message": "All models loaded successfully"}, ensure_ascii=False))
    sys.stdout.flush()
    print("[Python] ✓ Ready signal sent!", file=sys.stderr)

except Exception as e:
    error_msg = f"[Python] ✗ Model loading failed: {str(e)}"
    print(error_msg, file=sys.stderr)
    print(json.dumps({"type": "ERROR", "message": str(e)}, ensure_ascii=False))
    sys.stdout.flush()
    sys.exit(1)

# ==============================================================================
# QUẢN LÝ TỪ ĐIỂN RAG (knowledge_base.json)
# ==============================================================================
def load_knowledge():
    """Load từ điển món ăn từ file JSON. Tự động trỏ về thư mục src/ nếu đang chạy từ dist/."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
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

# Nạp từ điển vào bộ nhớ và tính toán trước vector embeddings
rag_data = load_knowledge()
vi_keys = list(rag_data.keys())
en_keys = list(rag_data.values())
knowledge_embeddings_vi = search_model.encode(vi_keys, convert_to_tensor=True) if vi_keys else None
knowledge_embeddings_en = search_model.encode(en_keys, convert_to_tensor=True) if en_keys else None
print(f"[Python] ✓ RAG dictionary loaded: {len(vi_keys)} entries", file=sys.stderr)


# ==============================================================================
# HÀM DỊCH CƠ BẢN (VinAI)
# ==============================================================================
def _generate_translation(model, tokenizer, text, target_lang):
    """Dịch một đoạn text bằng model VinAI Seq2Seq."""
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=1024)
    inputs = {k: v.to(TRANSLATION_DEVICE) for k, v in inputs.items()}
    max_new_tokens = min(TRANSLATION_MAX_NEW_TOKENS, max(64, int(inputs["input_ids"].shape[1] * 2.0)))
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            decoder_start_token_id=tokenizer.lang_code_to_id[target_lang],
            num_return_sequences=1,
            num_beams=TRANSLATION_NUM_BEAMS,
            max_new_tokens=max_new_tokens,
        )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

def translate_en2vi(en_text):
    """Dịch English → Vietnamese bằng VinAI."""
    return _generate_translation(model_en2vi, tokenizer_en2vi, en_text, "vi_VN")

def translate_vi2en(vi_text):
    """Dịch Vietnamese → English bằng VinAI."""
    return _generate_translation(model_vi2en, tokenizer_vi2en, vi_text, "en_XX")


# ==============================================================================
# HÀM DỊCH THÔNG MINH (Smart Routing)
# ==============================================================================
# Chiến lược phân luồng:
#   - source="scan" (từ quét ảnh menu): Dùng RAG trước, nếu không tìm thấy → VinAI fallback
#   - source="chat" (người dùng tự nhập): Bỏ qua RAG, dùng VinAI trực tiếp cho nhanh
# ==============================================================================

def smart_tourism_ai(user_input, method='en2vi', source='chat'):
    """
    Hàm dịch chính của hệ thống SmartMenu.
    
    Args:
        user_input: Văn bản cần dịch (có thể nhiều dòng)
        method: 'en2vi' (Anh→Việt) hoặc 'vi2en' (Việt→Anh)
        source: 'scan' (quét menu, ưu tiên RAG) hoặc 'chat' (tự nhập, VinAI trực tiếp)
    
    Returns:
        Dict chứa input, output, method (RAG hoặc VinAI)
    """
    lines = user_input.split('\n')
    translated_lines = []
    any_rag_matched = False

    # -------------------------------------------------------
    # LUỒNG CHAT: Bỏ qua RAG hoàn toàn, dịch trực tiếp bằng VinAI
    # Lý do: Câu chat thường dài, không có trong từ điển món ăn.
    #         Bỏ qua RAG giúp tiết kiệm ~2 giây encoding overhead.
    # -------------------------------------------------------
    if source == 'chat':
        translate_fn = translate_en2vi if method == 'en2vi' else translate_vi2en
        # Ghép tất cả các dòng lại thành 1 chuỗi để dịch 1 lần (nhanh hơn dịch từng dòng)
        full_text = user_input.strip()
        if full_text:
            translated_text = translate_fn(full_text)
        else:
            translated_text = ""
        
        return {
            "input": user_input,
            "output": translated_text,
            "method": "VinAI"
        }

    # -------------------------------------------------------
    # LUỒNG QUÉT MENU (source="scan"): Dùng RAG + VinAI fallback
    # Mỗi dòng được xử lý riêng vì menu có nhiều món trên nhiều dòng.
    # -------------------------------------------------------
    
    # Thiết lập biến theo chiều dịch
    if method == 'vi2en':
        source_keys = vi_keys
        target_keys = en_keys
        embeddings = knowledge_embeddings_vi
        translate_fallback = translate_vi2en
    else:
        source_keys = en_keys
        target_keys = vi_keys
        embeddings = knowledge_embeddings_en
        translate_fallback = translate_en2vi

    for line in lines:
        if not line.strip():
            translated_lines.append("")
            continue
            
        # --- TÁCH TÊN MÓN VÀ GIÁ TIỀN ---
        # Regex tách tên món và mọi loại giá (VND, vnđ, k, đ, ₫)
        price_pattern = r'^(.*?)\s*((?:[\d.,]+\s*(?:[kKđĐ₫]|vnd|vnđ|VND|VNĐ)?\s*[-/]?\s*)+)$'
        match = re.match(price_pattern, line, flags=re.IGNORECASE)
        if match:
            item_name = match.group(1).strip()
            item_name = re.sub(r'[\.\-\s]+$', '', item_name)
            item_name = re.sub(r'^[-\s]+', '', item_name)  # Xóa dấu '-' ở đầu
            price = match.group(2).strip()
        else:
            item_name = line.strip()
            item_name = re.sub(r'[\.\-\s]+$', '', item_name)
            item_name = re.sub(r'^[-\s]+', '', item_name)
            price = ""
            
        if not item_name:
            translated_lines.append(price)
            continue

        # --- BỘ LỌC THÔNG MINH (Chống rác Database) ---
        is_noise = False
        lower_name = item_name.lower()
        
        # 1. Lọc địa chỉ & Thông tin liên hệ
        noise_keywords = [
            'phường', 'quận', 'tp.', 'thành phố', 
            'ltd', 'co.', 'company', 'corp', 'hotline', 'tel:', 'đt:',
            'website', 'www.', '.com', '.vn', '.net', 'facebook', 'fb.com'
        ]
        if any(kw in lower_name for kw in noise_keywords) or re.search(r'\b[pq]\d+\b', lower_name) or lower_name.count('/') >= 2:
            is_noise = True
            
        # 2. Lọc SĐT (quá ít chữ cái, nhiều số/kí tự đặc biệt)
        if not is_noise:
            letters_only = re.sub(r'[^a-zA-Z\u00C0-\u1EF9]', '', item_name)
            if len(letters_only) < 3 and len(item_name) >= 5:
                is_noise = True
        
        # Nếu là rác, giữ nguyên không dịch
        if is_noise:
            translated_lines.append(f"{item_name} {price}".strip())
            continue

        # --- TRA CỨU RAG (chỉ chạy khi source="scan") ---
        translated_name = ""
        
        # Bước 1: Exact Match (so khớp chính xác, case-insensitive)
        lower_item_name = item_name.lower()
        for i, s_key in enumerate(source_keys):
            if lower_item_name == s_key.lower():
                translated_name = target_keys[i]
                any_rag_matched = True
                break
                
        # Bước 2: Semantic Search (tìm kiếm ngữ nghĩa)
        # Chỉ chạy nếu Exact Match thất bại VÀ tên món ngắn (< 6 từ)
        # Tên món dài thường là mô tả/slogan → không nên dùng RAG
        if not translated_name and embeddings is not None and len(source_keys) > 0:
            word_count = len(item_name.split())
            if word_count < 6:
                user_vec = search_model.encode(item_name, convert_to_tensor=True)
                hits = util.semantic_search(user_vec, embeddings, top_k=1)
                # Ngưỡng 0.93: Cân bằng giữa chính xác và tốc độ
                if hits and len(hits[0]) > 0 and hits[0][0]['score'] > 0.93:
                    translated_name = target_keys[hits[0][0]['corpus_id']]
                    any_rag_matched = True
        
        # Bước 3: VinAI Fallback
        # Nếu RAG không tìm thấy, dùng VinAI dịch trực tiếp
        if not translated_name:
            # Chuyển về chữ thường để VinAI dịch chính xác hơn (tránh lỗi ALL CAPS)
            raw_translation = translate_fallback(item_name.lower())
            translated_name = raw_translation.strip().title()

            # Chống ảo giác (Hallucination): Nếu VinAI trả về từ vô nghĩa → giữ nguyên gốc
            translated_name = re.sub(r'^[-\s]+', '', translated_name).strip()
            if translated_name.lower() in ['hi', 'hello', 'hi there', 'yes', 'no', '', item_name.lower()]:
                translated_name = item_name
            
        # Bước 4: Ghép Tên và Giá lại
        final_line = f"{translated_name} {price}".strip()
        translated_lines.append(final_line)

    final_text = '\n'.join(translated_lines)
    
    return {
        "input": user_input,
        "output": final_text,
        "method": "RAG" if any_rag_matched else "VinAI"
    }


# ==============================================================================
# MAIN - ĐỌC TỪ STDIN (Giao tiếp với NestJS qua pipe)
# ==============================================================================
if __name__ == "__main__":
    for line in sys.stdin:
        try:
            data_input = json.loads(line.strip())
            result = smart_tourism_ai(
                data_input.get("text", ""),
                data_input.get("method", "en2vi"),
                data_input.get("source", "chat")  # Nhận tham số source từ NestJS
            )
            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
            sys.stdout.flush()
