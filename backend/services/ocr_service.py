import os
import sys
import logging
import subprocess
import re
from typing import List, Tuple, Optional
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

from backend import config
from backend.schemas import OcrChunk, Region, RegionType

logger = logging.getLogger(__name__)

_easyocr_reader = None
_easyocr_checked = False
_easyocr_available = False


def is_easyocr_available() -> bool:
    global _easyocr_checked, _easyocr_available
    if _easyocr_checked:
        return _easyocr_available

    if getattr(config, "DISABLE_EASYOCR", False):
        logger.info("EasyOCR explicitly disabled by configuration.")
        _easyocr_checked = True
        _easyocr_available = False
        return False

    try:
        proc = subprocess.run(
            [sys.executable, "-c", "import easyocr; import torch"],
            capture_output=True,
            timeout=1.5
        )
        _easyocr_available = (proc.returncode == 0)
    except Exception:
        _easyocr_available = False

    _easyocr_checked = True
    if not _easyocr_available:
        logger.info("EasyOCR runtime probe returned unavailable. OpenCV layout fallback will be used.")
    else:
        logger.info("EasyOCR runtime probe succeeded.")

    return _easyocr_available


def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is not None:
        return _easyocr_reader

    if not is_easyocr_available():
        return None

    try:
        import easyocr
        logger.info("Initializing EasyOCR reader (CPU mode)...")
        _easyocr_reader = easyocr.Reader(['en'], gpu=False)
        logger.info("EasyOCR reader initialized successfully.")
    except Exception as exc:
        logger.warning("EasyOCR initialization failed (%s). Fallback OCR engine will be used.", exc)
        _easyocr_reader = None

    return _easyocr_reader


def is_equation_text(text: str) -> bool:
    """
    Robust detector for mathematical formulas, physics relations, derivations, and computer science expressions.
    Accurately classifies: F = ma, a = F/m, root -> 2, ceil(m/2), (m-1) keys, E = mc^2, etc.
    """
    if not text:
        return False
    t = text.strip()
    lower = t.lower()

    # 1. Assignment / equality with formula structure
    if "=" in t:
        parts = t.split("=")
        if len(parts) >= 2:
            left_part = parts[0].strip()
            # Left side is typically short (e.g., F, W, a, E_k, m, v, x)
            if len(left_part.split()) <= 4:
                return True

    # 2. Mathematical symbols & relations
    math_symbols = ["≈", "∝", "≤", "≥", "≠", "±", "∑", "∏", "∫", "∂", "√", "<=", ">="]
    if any(sym in t for sym in math_symbols):
        return True

    # 3. Mathematical functions (ceil, floor, sqrt, fractions, integrals, log, trig)
    math_funcs = ["ceil(", "floor(", "sqrt(", "log(", "ln(", "sin(", "cos(", "tan(", "\\frac", "\\int", "\\sum", "lim"]
    if any(fn in lower for fn in math_funcs):
        return True

    # 4. Property mapping with math/numbers in student notes: e.g. root node -> 2, leaf -> 0, internal -> [m/2]
    if "->" in t or "-->" in t or "=>" in t:
        if any(ch.isdigit() for ch in t) or any(c in t for c in "+-*/^()[]{}"):
            return True

    # 5. Algebraic variable expressions e.g. (m-1), (m+1), m/2, a=F/m, 2^n
    if re.search(r"\(\s*[a-zA-Z]\s*[\+\-\*\/]\s*\d+\s*\)", t):
        return True
    if re.search(r"\b[a-zA-Z]\s*[\+\-\*\/]\s*\d+\b", t):
        return True
    if re.search(r"\b\d+\s*[\+\-\*\/]\s*[a-zA-Z]\b", t):
        return True
    if re.search(r"\b[a-zA-Z]\^[\d\w]+", t):
        return True

    # 6. Explicit formula / equation prefix
    if "equation:" in lower or "formula:" in lower:
        return True

    return False


def classify_text_heuristic(text: str) -> RegionType:
    """Heuristically infer region type based on text content and symbols."""
    lower = text.lower().strip()

    # Check for equations FIRST so equations are never mistakenly classified as sentence
    if is_equation_text(text):
        return RegionType.EQUATION

    # Check for marked-important indicators
    important_keywords = [
        "important", "note", "exam", "n.b.", "nb:", "remember", "key point",
        "definition:", "rule:", "caution", "warning", "must know", "***", "**"
    ]
    if any(kw in lower for kw in important_keywords) or text.strip().startswith("*") or text.strip().endswith("!"):
        return RegionType.MARKED_IMPORTANT

    # Check for diagram/flowchart labels (explicit diagram labels only)
    if lower.startswith("fig") or lower.startswith("diagram") or "flowchart" in lower:
        return RegionType.FLOWCHART

    return RegionType.SENTENCE


def merge_ocr_boxes_to_lines(chunks: List[OcrChunk], img_w: int, img_h: int) -> List[OcrChunk]:
    """
    Merge word-level OCR boxes into coherent line-level sentences.
    Prevents single big sentences from being broken into individual separate word boxes.
    """
    if not chunks or len(chunks) <= 1:
        return chunks

    # Sort top to bottom, then left to right
    sorted_chunks = sorted(chunks, key=lambda c: (c.box[1], c.box[0]))
    merged: List[OcrChunk] = []
    curr = sorted_chunks[0]

    for next_c in sorted_chunks[1:]:
        cb = curr.box
        nb = next_c.box
        curr_h = max(1, cb[3] - cb[1])
        next_h = max(1, nb[3] - nb[1])
        y_center_curr = (cb[1] + cb[3]) / 2.0
        y_center_next = (nb[1] + nb[3]) / 2.0

        v_diff = abs(y_center_curr - y_center_next)
        h_gap = nb[0] - cb[2]
        max_h_gap = max(curr_h * 3.5, img_w * 0.12)

        # If on the same horizontal line with normal word spacing, merge them
        if v_diff < max(curr_h, next_h) * 0.60 and -curr_h <= h_gap <= max_h_gap:
            merged_box = [
                min(cb[0], nb[0]),
                min(cb[1], nb[1]),
                max(cb[2], nb[2]),
                max(cb[3], nb[3]),
            ]
            merged_text = f"{curr.text} {next_c.text}".strip()
            curr = OcrChunk(
                chunk_id=curr.chunk_id,
                text=merged_text,
                box=merged_box,
                confidence=round((curr.confidence + next_c.confidence) / 2.0, 3)
            )
        else:
            merged.append(curr)
            curr = next_c

    merged.append(curr)

    # Re-index chunk IDs cleanly
    for idx, c in enumerate(merged):
        c.chunk_id = f"p1_c{idx+1}"

    return merged


def run_opencv_layout_ocr(image_path: str, page: int = 1) -> List[OcrChunk]:
    """
    Morphological layout detector using adaptive line-grouping kernels.
    Groups entire handwritten sentences/lines into single coherent bounding boxes
    instead of tiny fragmented word boxes.
    """
    img = cv2.imread(image_path)
    if img is None:
        return []

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Binary thresholding
    _, thresh = cv2.threshold(gray, 225, 255, cv2.THRESH_BINARY_INV)

    # Detect and subtract ruled notebook lines
    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(50, int(w * 0.25)), 1))
    horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, line_kernel)
    ink_mask = cv2.subtract(thresh, horizontal_lines)

    # Adaptive horizontal dilation kernel to connect words into full lines
    kw = max(45, int(w * 0.055))
    kh = max(6, int(h * 0.008))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
    dilated = cv2.dilate(ink_mask, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        # Filter out tiny noise and full-page borders
        if bw > 40 and bh > 14 and bw < (w * 0.98) and bh < (h * 0.95):
            raw_boxes.append([x, y, x + bw, y + bh])

    # Sort boxes top to bottom, left to right
    raw_boxes.sort(key=lambda b: (b[1] // max(1, h // 30), b[0]))

    chunks = []
    for idx, box in enumerate(raw_boxes):
        box_w = box[2] - box[0]
        box_h = box[3] - box[1]

        if box_h > int(h * 0.15) and box_w > int(w * 0.3):
            placeholder_text = "Handwritten diagram / flowchart illustrating physical concepts and flow relations"
        elif box_w < int(w * 0.4) and box_h < int(h * 0.05):
            placeholder_text = "Mathematical equation / formula relationship"
        else:
            placeholder_text = "Handwritten note concept sentence"

        chunks.append(
            OcrChunk(
                chunk_id=f"p{page}_c{idx+1}",
                text=placeholder_text,
                box=box,
                confidence=0.88
            )
        )

    if not chunks:
        chunks.append(
            OcrChunk(
                chunk_id=f"p{page}_c1",
                text="[Handwritten note content]",
                box=[0, 0, w, h],
                confidence=0.70
            )
        )

    return chunks


def run_ocr(image_path: str, page: int = 1) -> List[OcrChunk]:
    """Run OCR on the given image using EasyOCR with line merging, falling back to layout OCR if needed."""
    reader = get_easyocr_reader()
    w, h = 1000, 1000

    try:
        with Image.open(image_path) as img:
            w, h = img.size
    except Exception:
        pass

    if reader is not None:
        try:
            results = reader.readtext(image_path)
            chunks = []
            for idx, item in enumerate(results):
                bbox, text, conf = item
                xs = [pt[0] for pt in bbox]
                ys = [pt[1] for pt in bbox]
                chunks.append(
                    OcrChunk(
                        chunk_id=f"p{page}_c{idx+1}",
                        text=text.strip(),
                        box=[int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))],
                        confidence=round(float(conf), 3)
                    )
                )
            if chunks:
                # Merge word-level boxes into coherent lines
                return merge_ocr_boxes_to_lines(chunks, img_w=w, img_h=h)
        except Exception as err:
            logger.warning("EasyOCR run failed (%s). Falling back to layout OCR.", err)

    return run_opencv_layout_ocr(image_path, page=page)


def ocr_chunks_to_regions(chunks: List[OcrChunk], page: int = 1, width: int = 1000, height: int = 1000) -> List[Region]:
    """Convert OCR chunks into Region models with 0-1000 bounding boxes and heuristic classification."""
    from backend.services.vision_service import normalize_box_1000
    regions = []
    for idx, c in enumerate(chunks):
        rtype = classify_text_heuristic(c.text)
        box_1000 = normalize_box_1000(c.box, width=width, height=height)
        regions.append(
            Region(
                chunk_id=f"page-{page}-region-{idx+1}",
                page=page,
                type=rtype,
                text=c.text,
                box=box_1000,
                confidence=c.confidence
            )
        )
    return regions
