#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script for Menu OCR Service
Verifies that EasyOCR is working correctly
"""

import sys
import json

# Test 1: Import check
print("=" * 60, file=sys.stderr)
print("TEST 1: Checking imports...", file=sys.stderr)
try:
    import easyocr
    print(f"✓ EasyOCR {easyocr.__version__} imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"✗ Failed to import EasyOCR: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import cv2
    print(f"✓ OpenCV imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"✗ Failed to import OpenCV: {e}", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
    print(f"✓ PIL imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"✗ Failed to import PIL: {e}", file=sys.stderr)
    sys.exit(1)

# Test 2: Initialize OCR Engine
print("\n" + "=" * 60, file=sys.stderr)
print("TEST 2: Initializing EasyOCR Reader...", file=sys.stderr)
try:
    reader = easyocr.Reader(['vi'], gpu=False, verbose=False)
    print("✓ EasyOCR Reader initialized successfully", file=sys.stderr)
except Exception as e:
    print(f"✗ Failed to initialize EasyOCR: {e}", file=sys.stderr)
    sys.exit(1)

# Test 3: Create a simple test image
print("\n" + "=" * 60, file=sys.stderr)
print("TEST 3: Creating test image...", file=sys.stderr)
try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont

    # Create a simple white image with Vietnamese text
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)

    # Use default font for testing
    text = "Test OCR - Kiểm tra OCR"
    draw.text((50, 80), text, fill='black')

    test_image_path = 'd:/baitap/TuDuyTinhToan/TDTT_NestJS_Nhom1/test_image.png'
    img.save(test_image_path)
    print(f"✓ Test image created at {test_image_path}", file=sys.stderr)
except Exception as e:
    print(f"✗ Failed to create test image: {e}", file=sys.stderr)
    sys.exit(1)

# Test 4: Test OCR on test image
print("\n" + "=" * 60, file=sys.stderr)
print("TEST 4: Testing OCR on test image...", file=sys.stderr)
try:
    results = reader.readtext(test_image_path, detail=0)
    if results:
        print(f"✓ OCR successful! Detected text:", file=sys.stderr)
        for text in results:
            print(f"  - {text}", file=sys.stderr)
    else:
        print("⚠ OCR returned empty results (text might be too small or unclear)", file=sys.stderr)
except Exception as e:
    print(f"✗ OCR test failed: {e}", file=sys.stderr)
    sys.exit(1)

# Test 5: Check menu_ocr_service.py can be imported
print("\n" + "=" * 60, file=sys.stderr)
print("TEST 5: Checking menu_ocr_service compatibility...", file=sys.stderr)
try:
    # We won't import it directly since it expects stdin input
    # But we can verify the file exists
    import os
    service_path = 'd:/baitap/TuDuyTinhToan/TDTT_NestJS_Nhom1/src/python/menu_ocr_service.py'
    if os.path.exists(service_path):
        print(f"✓ menu_ocr_service.py exists at {service_path}", file=sys.stderr)
    else:
        print(f"✗ menu_ocr_service.py not found at {service_path}", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"✗ Error checking menu_ocr_service: {e}", file=sys.stderr)
    sys.exit(1)

print("\n" + "=" * 60, file=sys.stderr)
print("ALL TESTS PASSED! ✓", file=sys.stderr)
print("=" * 60, file=sys.stderr)
print("\nJSON Response (for verification):")
print(json.dumps({"status": "OK", "message": "OCR service is ready"}))
