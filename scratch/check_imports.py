import sys
try:
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang='vi')
    print("paddleocr initialized successfully")
except Exception as e:
    print(f"paddleocr initialization failed: {e}")

try:
    from vietocr.tool.predictor import Predictor
    from vietocr.tool.config import Cfg
    config = Cfg.load_config_from_name('vgg_transformer')
    config['device'] = 'cpu'
    detector = Predictor(config)
    print("vietocr Predictor initialized successfully")
except Exception as e:
    print(f"vietocr Predictor initialization failed: {e}")

try:
    import cv2
    print("opencv imported successfully")
except ImportError as e:
    print(f"opencv import failed: {e}")
