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
    if (
        method == 'en2vi'
        and classifier is not None
        and len(final_text) <= TRANSLATION_SENTIMENT_MAX_CHARS
    ):
        try:
            analysis = classifier(final_text)[0]
            sentiment = {
                "label": analysis['label'],
                "score": round(analysis['score'], 2)
            }
        except Exception:
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
