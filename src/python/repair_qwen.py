import os
from huggingface_hub import snapshot_download

import sys

# Fix Windows encoding
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# === CẤU HÌNH ===
cache_dir = "D:/baitap/TuDuyTinhToan/models_cache"
model_name = "Qwen/Qwen2-VL-2B-Instruct"

def repair_model():
    print(f"--- Đang kiểm tra và tải phần còn thiếu cho model: {model_name} ---")
    print(f"Cache directory: {cache_dir}")
    
    try:
        # Chỉ tải các file .safetensors và config cần thiết để tiết kiệm thời gian
        # snapshot_download sẽ tự động bỏ qua các file đã tải xong
        snapshot_download(
            repo_id=model_name,
            cache_dir=cache_dir,
            ignore_patterns=["*.msgpack", "*.h5", "*.ot"], # Bỏ qua các định dạng không dùng
            resume_download=True
        )
        print("\n--- Chúc mừng! Model đã được tải đầy đủ và sẵn sàng sử dụng. ---")
    except Exception as e:
        print(f"\n--- Lỗi khi tải model: {e} ---")
        print("Hãy kiểm tra kết nối internet của bạn và thử lại.")

if __name__ == "__main__":
    repair_model()
