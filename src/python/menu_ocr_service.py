import os
import sys
import json
import re
import warnings
from typing import List

warnings.filterwarnings('ignore')

# Fix Windows encoding for Vietnamese
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# === CONFIGURATION ===
MAX_SHORT_SIDE = int(os.getenv('OCR_MAX_SHORT_SIDE', '960'))
PAD_RATIO = float(os.getenv('OCR_PAD_RATIO', '0.015'))
MIN_BOX_HEIGHT = int(os.getenv('OCR_MIN_BOX_HEIGHT', '12'))
DET_LIMIT_SIDE_LEN = int(os.getenv('OCR_DET_LIMIT_SIDE_LEN', '960'))
DET_LIMIT_TYPE = os.getenv('OCR_DET_LIMIT_TYPE', 'max')
USE_ANGLE_CLS = os.getenv('OCR_USE_ANGLE_CLS', 'false').lower() == 'true'
SKIP_AUTOCROP = os.getenv('OCR_SKIP_AUTOCROP', 'false').lower() == 'true'
VIETOCR_CONFIG = os.getenv('VIETOCR_CONFIG', 'vgg_transformer')
VIETOCR_BEAMSEARCH = os.getenv('VIETOCR_BEAMSEARCH', 'false').lower() == 'true'
VIETOCR_DEVICE = os.getenv('VIETOCR_DEVICE', 'cpu')


class LazyOcrEngine:
    def __init__(self):
        self.detector = None
        self.recognizer = None
        print('Initializing LazyOcrEngine (PaddleOCR detector + VietOCR recognizer)...', file=sys.stderr)

    def _ensure_loaded(self):
        if self.detector is not None and self.recognizer is not None:
            return

        print('Loading PaddleOCR detector (vi, det-only)...', file=sys.stderr)
        from paddleocr import PaddleOCR

        # Detector only for speed. Angle classifier off by default for CPU speed.
        self.detector = PaddleOCR(
            lang='vi',
            det=True,
            rec=False,
            use_angle_cls=USE_ANGLE_CLS,
            det_limit_side_len=DET_LIMIT_SIDE_LEN,
            det_limit_type=DET_LIMIT_TYPE,
        )

        print('Loading VietOCR recognizer...', file=sys.stderr)
        from vietocr.tool.predictor import Predictor
        from vietocr.tool.config import Cfg

        cfg = Cfg.load_config_from_name(VIETOCR_CONFIG)
        cfg['device'] = VIETOCR_DEVICE
        cfg['predictor']['beamsearch'] = VIETOCR_BEAMSEARCH
        cfg['cnn']['pretrained'] = True
        self.recognizer = Predictor(cfg)
        print('Models loaded successfully!', file=sys.stderr)

    def _auto_crop_main_content(self, img):
        """Crop to the largest non-background region (usually the menu poster)."""
        import cv2
        import numpy as np

        h, w = img.shape[:2]
        if h < 10 or w < 10:
            return img

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img

        largest = max(contours, key=cv2.contourArea)
        x, y, cw, ch = cv2.boundingRect(largest)
        min_area = 0.2 * h * w
        if cw * ch < min_area:
            return img

        pad = int(0.02 * min(h, w))
        x0 = max(0, x - pad)
        y0 = max(0, y - pad)
        x1 = min(w, x + cw + pad)
        y1 = min(h, y + ch + pad)
        return img[y0:y1, x0:x1]

    def _resize_for_detection(self, img):
        import cv2

        h, w = img.shape[:2]
        short_side = min(h, w)
        if short_side <= MAX_SHORT_SIDE:
            return img

        scale = float(MAX_SHORT_SIDE) / float(short_side)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    def _detect_boxes(self, img) -> List[List[List[float]]]:
        """Return list of 4-point boxes."""
        result = self.detector.ocr(img, det=True, rec=False, cls=False)
        if not result:
            return []

        # PaddleOCR sometimes returns nested list for multiple images.
        if isinstance(result, list) and result and isinstance(result[0], list):
            if result and result[0] and isinstance(result[0][0], list) and result[0][0]:
                # Nested case: [ [boxes], ... ]
                if isinstance(result[0][0][0], (list, tuple)):
                    return result[0]

        return result

    def _boxes_to_rows(self, boxes, image_width):
        """Group detection boxes into text rows."""
        if not boxes:
            return []

        tokens = []
        for box in boxes:
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            xmin, xmax = min(xs), max(xs)
            ymin, ymax = min(ys), max(ys)
            h = max(1.0, float(ymax - ymin))
            if h < MIN_BOX_HEIGHT:
                continue
            tokens.append(
                {
                    'xmin': xmin,
                    'xmax': xmax,
                    'ymin': ymin,
                    'ymax': ymax,
                    'x': (xmin + xmax) / 2.0,
                    'y': (ymin + ymax) / 2.0,
                    'h': h,
                }
            )

        if not tokens:
            return []

        tokens = sorted(tokens, key=lambda t: t['y'])
        median_h = sorted([t['h'] for t in tokens])[len(tokens) // 2]
        row_threshold = max(10.0, 0.6 * median_h)

        rows = []
        for token in tokens:
            placed = False
            for row in rows:
                if abs(token['y'] - row['y']) <= row_threshold:
                    row['tokens'].append(token)
                    row['y'] = (row['y'] + token['y']) / 2.0
                    placed = True
                    break
            if not placed:
                rows.append({'y': token['y'], 'tokens': [token]})

        line_boxes = []
        for row in sorted(rows, key=lambda r: r['y']):
            row_tokens = sorted(row['tokens'], key=lambda t: t['xmin'])
            xmin = min(t['xmin'] for t in row_tokens)
            xmax = max(t['xmax'] for t in row_tokens)
            ymin = min(t['ymin'] for t in row_tokens)
            ymax = max(t['ymax'] for t in row_tokens)
            line_boxes.append((xmin, ymin, xmax, ymax))

        return line_boxes

    def _crop_with_padding(self, img, box):
        import cv2

        h, w = img.shape[:2]
        xmin, ymin, xmax, ymax = box
        pad = int(round(PAD_RATIO * max(ymax - ymin, xmax - xmin)))
        x0 = max(0, int(xmin - pad))
        y0 = max(0, int(ymin - pad))
        x1 = min(w, int(xmax + pad))
        y1 = min(h, int(ymax + pad))
        crop = img[y0:y1, x0:x1]
        if crop.size == 0:
            return None

        # Slight denoise to help recognizer.
        crop = cv2.bilateralFilter(crop, d=5, sigmaColor=50, sigmaSpace=50)
        return crop

    def _recognize_lines(self, crops: List):
        from PIL import Image
        import cv2

        pil_images = []
        for crop in crops:
            if crop is None:
                pil_images.append(None)
                continue
            rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            pil_images.append(Image.fromarray(rgb))

        texts = []
        if hasattr(self.recognizer, 'predict_batch'):
            batch_images = [img for img in pil_images if img is not None]
            batch_texts = self.recognizer.predict_batch(batch_images) if batch_images else []
            it = iter(batch_texts)
            for img in pil_images:
                texts.append(next(it) if img is not None else '')
        else:
            for img in pil_images:
                texts.append(self.recognizer.predict(img) if img is not None else '')

        return texts

    def _normalize_vietnamese_ocr_errors(self, text):
        replacements = [
            (r'\bDac\b', 'Đặc'),
            (r'\bBiet\b', 'Biệt'),
            (r'\bTra\b', 'Trà'),
            (r'\bsua\b', 'sữa'),
            (r'\bduong\b', 'đường'),
            (r'\bden\b', 'đen'),
        ]

        out = text
        for pattern, value in replacements:
            out = re.sub(pattern, value, out, flags=re.IGNORECASE)

        return out

    def _is_price_only(self, text):
        return bool(re.fullmatch(r'(\d{1,3})(k)?', text.lower()))

    def _is_temp_only(self, text):
        t = text.lower()
        return ('đá' in t or 'nong' in t or 'nóng' in t) and len(t.split()) <= 4

    def _is_noise_line(self, text):
        raw = text.strip().lower()
        words = [w for w in re.split(r'\s+', raw) if w]
        if not words:
            return True

        if len(words) == 1:
            word = re.sub(r'[^\w\-\u00C0-\u1EF9]', '', words[0])
            if len(word) <= 2 and not re.search(r'\d', word):
                return True

        return False

    def _postprocess_lines(self, lines):
        cleaned = []
        for line in lines:
            text = re.sub(r'\.{2,}', ' ', line)
            text = re.sub(r'\s+', ' ', text).strip()
            if len(text) <= 1:
                continue

            text = self._normalize_vietnamese_ocr_errors(text)

            text = re.sub(r'\b(\d{1,3})\s*[kK]\b', r'\1k', text)
            text = re.sub(r'\b(\d{1,3})[\.,]000\b', r'\1k', text)

            cleaned.append(text)

        merged = []
        for line in cleaned:
            if merged and (self._is_price_only(line) or self._is_temp_only(line)):
                merged[-1] = f'{merged[-1]} {line}'.strip()
                continue

            if self._is_noise_line(line):
                continue

            merged.append(line)

        return merged

    def process_image(self, image_path):
        try:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f'Image not found at {image_path}')

            self._ensure_loaded()

            import cv2
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f'Could not read image at {image_path}')

            print(f'Processing image: {image_path}', file=sys.stderr)

            cropped = img if SKIP_AUTOCROP else self._auto_crop_main_content(img)
            prepared = self._resize_for_detection(cropped)

            boxes = self._detect_boxes(prepared)
            if not boxes:
                print('No text boxes detected', file=sys.stderr)
                return ''

            line_boxes = self._boxes_to_rows(boxes, prepared.shape[1])
            crops = [self._crop_with_padding(prepared, box) for box in line_boxes]
            raw_lines = self._recognize_lines(crops)

            lines = self._postprocess_lines(raw_lines)
            if not lines:
                return ''

            extracted_text = '\n'.join(lines)
            print(f'Extracted {len(lines)} lines', file=sys.stderr)
            return extracted_text

        except Exception as e:
            print(f'Error processing image: {str(e)}', file=sys.stderr)
            raise


engine = LazyOcrEngine()


def process_request(request_json):
    try:
        image_path = request_json.get('image_path')
        if not image_path:
            return {'success': False, 'error': 'No image_path provided'}

        text = engine.process_image(image_path)
        return {'success': True, 'text': text}

    except Exception as e:
        error_msg = f'{type(e).__name__}: {str(e)}'
        print(f'Error: {error_msg}', file=sys.stderr)
        return {'success': False, 'error': error_msg}


if __name__ == '__main__':
    print('Menu OCR Service Started (PaddleOCR det + VietOCR rec)', file=sys.stderr)
    print('Models will be loaded on first request...', file=sys.stderr)
    print('Waiting for requests...', file=sys.stderr)

    try:
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                request_json = json.loads(line.strip())
                response = process_request(request_json)
                print(json.dumps(response, ensure_ascii=False))
                sys.stdout.flush()

            except json.JSONDecodeError as e:
                error_response = {'success': False, 'error': f'Invalid JSON: {str(e)}'}
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()
            except Exception as e:
                error_response = {'success': False, 'error': str(e)}
                print(json.dumps(error_response, ensure_ascii=False))
                sys.stdout.flush()

    except KeyboardInterrupt:
        print('Service interrupted', file=sys.stderr)
    except Exception as e:
        print(f'Fatal error: {str(e)}', file=sys.stderr)
        sys.exit(1)
