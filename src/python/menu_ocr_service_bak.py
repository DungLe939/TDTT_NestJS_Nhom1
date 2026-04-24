import os
import sys
import json
import torch
import warnings
import traceback
import pathlib
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor, BitsAndBytesConfig
from qwen_vl_utils import process_vision_info

warnings.filterwarnings('ignore')

# Fix Windows encoding cho tiếng Việt
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# === CẤU HÌNH ===
cache_dir = "D:/baitap/TuDuyTinhToan/models_cache"
model_name = "Qwen/Qwen2-VL-2B-Instruct"

# Global variables
model = None
processor = None

def load_model():
    global model, processor
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Qwen2-VL model on {device}...", file=sys.stderr)
        
        load_params = {
            "pretrained_model_name_or_path": model_name,
            "cache_dir": cache_dir,
            "local_files_only": True
        }

        # Chỉ sử dụng 4-bit nếu có GPU
        if torch.cuda.is_available():
            print("Using 4-bit quantization (bitsandbytes)...", file=sys.stderr)
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True
            )
            load_params["quantization_config"] = quantization_config
            load_params["device_map"] = "auto"
            load_params["torch_dtype"] = "auto"
        else:
            print("CUDA not available. Loading on CPU with float32...", file=sys.stderr)
            load_params["device_map"] = "cpu"
            load_params["torch_dtype"] = torch.float32 

        model = Qwen2VLForConditionalGeneration.from_pretrained(**load_params)
        processor = AutoProcessor.from_pretrained(model_name, cache_dir=cache_dir, local_files_only=True)
        print(f"Model loaded successfully on {model.device}!", file=sys.stderr)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        sys.exit(1)

def extract_text(image_path):
    if model is None or processor is None:
        load_model()

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")

    # Sử dụng đường dẫn tuyệt đối trực tiếp cho qwen_vl_utils (hỗ trợ tốt hơn file URI trên Windows)
    image_uri = os.path.abspath(image_path)
    print(f"Processing image: {image_uri}", file=sys.stderr)

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "image": image_uri,
                    "max_pixels": 600 * 600, # Giới hạn độ phân giải để chạy nhanh trên CPU
                },
                {"type": "text", "text": "Hãy đọc và trích xuất toàn bộ văn bản có trong hình ảnh này. Trả về dưới dạng đoạn văn bản thô."},
            ],
        }
    ]

    print("Applying chat template...", file=sys.stderr)
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    print("Processing vision info...", file=sys.stderr)
    image_inputs, video_inputs = process_vision_info(messages)
    
    print("Preparing inputs...", file=sys.stderr)
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    )
    
    inputs = inputs.to(model.device)

    print(f"Starting model.generate on {model.device}...", file=sys.stderr)
    # max_new_tokens=1024 để đảm bảo đọc hết menu dài
    generated_ids = model.generate(**inputs, max_new_tokens=1024, do_sample=False)
    
    print("Decoding results...", file=sys.stderr)
    generated_ids_trimmed = [
        out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )
    
    print("Inference completed!", file=sys.stderr)
    return output_text[0].strip()

if __name__ == "__main__":
    # Load model ngay khi khởi động
    load_model()
    
    # Vòng lặp nhận yêu cầu từ STDIN để duy trì process (Persistent Mode)
    print("AI Service Ready. Waiting for input...", file=sys.stderr)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            data_input = json.loads(line)
            image_path = data_input.get("image_path")
            
            if not image_path:
                print(json.dumps({"success": False, "error": "image_path is required"}, ensure_ascii=False))
            else:
                print(f"--- Đang xử lý ảnh: {os.path.basename(image_path)} ---", file=sys.stderr)
                text_result = extract_text(image_path)
                print(json.dumps({"success": True, "text": text_result}, ensure_ascii=False))
            
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}, ensure_ascii=False))
            sys.stdout.flush()
