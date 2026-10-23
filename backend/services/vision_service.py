import json
import logging
import base64
import mimetypes
import hashlib
import re
from pathlib import Path
from typing import List, Tuple, Optional, Any, Dict
from PIL import Image

from backend import config
from backend.schemas import Region, RegionType, RawVisionRegion, BoundingBox
from backend.services.ocr_service import run_ocr, ocr_chunks_to_regions

logger = logging.getLogger(__name__)

_ANALYSIS_CACHE: Dict[str, Tuple[List[Region], str]] = {}


def get_file_sha256(path: str) -> str:
    """Compute SHA-256 hash of an image file for caching."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def get_image_info(image_path: str) -> Tuple[int, int, str]:
    """Return width, height, and mime_type of an image."""
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    with Image.open(image_path) as img:
        width, height = img.size

    return width, height, mime_type


def normalize_box_1000(raw_box: Any, width: int = 1000, height: int = 1000) -> BoundingBox:
    """
    Normalize bounding box to strict 0-1000 integer scale: {x, y, width, height}.
    Origin: top-left corner.
    Enforces:
    - 0 <= x <= 1000, 0 <= y <= 1000
    - 1 <= width <= 1000 - x
    - 1 <= height <= 1000 - y
    - x + width <= 1000, y + height <= 1000
    - all values are integers.
    """
    if width <= 0:
        width = 1000
    if height <= 0:
        height = 1000

    x, y, w, h = 0, 0, 1000, 1000

    if isinstance(raw_box, dict):
        if "x" in raw_box and "y" in raw_box:
            try:
                rx = float(raw_box.get("x", 0))
                ry = float(raw_box.get("y", 0))
                rw = float(raw_box.get("width", 100))
                rh = float(raw_box.get("height", 100))
                # Check if normalized 0.0 - 1.0 floats
                if 0.0 <= rx <= 1.0 and 0.0 <= ry <= 1.0 and rw <= 1.0 and rh <= 1.0:
                    x = int(round(rx * 1000))
                    y = int(round(ry * 1000))
                    w = int(round(rw * 1000))
                    h = int(round(rh * 1000))
                elif (width > 1200 or height > 1200) and (rx > 1000 or ry > 1000 or rw > 1000 or rh > 1000):
                    # Absolute pixels
                    x = int(round((rx / width) * 1000))
                    y = int(round((ry / height) * 1000))
                    w = int(round((rw / width) * 1000))
                    h = int(round((rh / height) * 1000))
                else:
                    x = int(round(rx))
                    y = int(round(ry))
                    w = int(round(rw))
                    h = int(round(rh))
            except (ValueError, TypeError):
                x, y, w, h = 0, 0, 1000, 1000
        elif "left" in raw_box or "ymin" in raw_box or "xmin" in raw_box:
            try:
                x1 = float(raw_box.get("left", raw_box.get("xmin", 0)))
                y1 = float(raw_box.get("top", raw_box.get("ymin", 0)))
                x2 = float(raw_box.get("right", raw_box.get("xmax", width)))
                y2 = float(raw_box.get("bottom", raw_box.get("ymax", height)))
                return normalize_box_1000([x1, y1, x2, y2], width, height)
            except (ValueError, TypeError):
                x, y, w, h = 0, 0, 1000, 1000

    elif isinstance(raw_box, (list, tuple)) and len(raw_box) == 4:
        try:
            vals = [float(v) for v in raw_box]
            x1, y1, x2, y2 = vals
            min_x, max_x = min(x1, x2), max(x1, x2)
            min_y, max_y = min(y1, y2), max(y1, y2)

            if all(0.0 <= v <= 1.0 for v in vals):
                x = int(round(min_x * 1000))
                y = int(round(min_y * 1000))
                w = int(round((max_x - min_x) * 1000))
                h = int(round((max_y - min_y) * 1000))
            else:
                x = int(round((min_x / width) * 1000))
                y = int(round((min_y / height) * 1000))
                w = int(round(((max_x - min_x) / width) * 1000))
                h = int(round(((max_y - min_y) / height) * 1000))
        except (ValueError, TypeError):
            x, y, w, h = 0, 0, 1000, 1000

    # Enforce strict boundary limits: [0, 1000] and x + width <= 1000, y + height <= 1000
    x = max(0, min(999, int(x)))
    y = max(0, min(999, int(y)))
    w = max(1, int(w))
    h = max(1, int(h))

    if x + w > 1000:
        w = max(1, 1000 - x)
    if y + h > 1000:
        h = max(1, 1000 - y)

    return BoundingBox(x=x, y=y, width=w, height=h)


def normalize_box(raw_box: Any, width: int, height: int) -> List[int]:
    """Ensure box coordinates are valid [left, top, right, bottom] in absolute pixel space."""
    if isinstance(raw_box, dict) and "x" in raw_box:
        b1000 = normalize_box_1000(raw_box, width, height)
        left = int((b1000.x / 1000.0) * width)
        top = int((b1000.y / 1000.0) * height)
        right = int(((b1000.x + b1000.width) / 1000.0) * width)
        bottom = int(((b1000.y + b1000.height) / 1000.0) * height)
        return [left, top, right, bottom]

    if not isinstance(raw_box, (list, tuple)) or len(raw_box) != 4:
        return [0, 0, width, height]

    try:
        vals = [float(v) for v in raw_box]
    except (ValueError, TypeError):
        return [0, 0, width, height]

    if all(0.0 <= v <= 1.0 for v in vals):
        vals = [vals[0] * width, vals[1] * height, vals[2] * width, vals[3] * height]
    elif all(0 <= v <= 1000 for v in vals) and (width > 1200 or height > 1200):
        vals = [(vals[0] / 1000.0) * width, (vals[1] / 1000.0) * height, (vals[2] / 1000.0) * width, (vals[3] / 1000.0) * height]

    x1, y1, x2, y2 = vals
    left = max(0, min(int(min(x1, x2)), width))
    top = max(0, min(int(min(y1, y2)), height))
    right = max(0, min(int(max(x1, x2)), width))
    bottom = max(0, min(int(max(y1, y2)), height))

    if right <= left:
        right = min(width, left + 20)
    if bottom <= top:
        bottom = min(height, top + 20)

    return [left, top, right, bottom]


def analyze_with_gemini(image_path: str, page: int, width: int, height: int, mime_type: str) -> List[Region]:
    """Call Google Gemini Vision via google-genai SDK."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    prompt = f"""You are an expert AI vision assistant specialized in analyzing student handwritten study notes.
Image dimensions: width={width}px, height={height}px.

Your task is to analyze the handwritten note and detect all distinct meaningful regions.
Report uncertainty rather than guessing. Do not invent unreadable handwriting, equation symbols, missing diagram labels, or content absent from the note.

For each region:
1. Classify its type strictly into one of:
   - "equation": Mathematical equations, formulas, algebraic expressions, variable mappings, or arithmetic relations (e.g. F = ma, a = F/m, root -> 2, ceil(m/2), m-1 keys, W = F*d, E = mc^2). ANY line with formulas or mathematical symbols MUST be classified as "equation".
   - "sentence": Regular handwritten sentences, bullet points, titles, notes, or paragraphs.
   - "marked-important": Content that is visibly underlined, highlighted, boxed, starred (*), or accompanied by markers like "Important", "NB", "Note", or exclamation points.
   - "flowchart": Process flow diagrams, sequence of connected steps, decision diamonds/boxes connected by lines or arrows.
   - "diagram": Hand-drawn drawings, sketches, graphs, geometric shapes, or anatomical/system illustrations (not flowcharts).

CRITICAL SEGMENTATION RULE:
- Group handwritten words into COMPLETE lines, sentences, or bullet points.
- NEVER split a sentence or line into individual words or tiny pieces. Each line or sentence must be ONE continuous bounding box spanning across the full phrase.

2. Transcribe or describe:
   - For text/sentences/marked-important: Exact transcription of the full handwriting sentence.
   - For equations: Accurate formula transcription (LaTeX or mathematical notation).
   - For diagrams/flowcharts: Comprehensive verbal description of the diagram and all visible labels.

3. Provide coordinates normalized to a 0-1000 integer scale:
   - "box": {{ "x": integer (0 to 1000), "y": integer (0 to 1000), "width": integer (0 to 1000), "height": integer (0 to 1000) }}
   where:
     x = top-left x (0 to 1000)
     y = top-left y (0 to 1000)
     width = region width (x + width <= 1000)
     height = region height (y + height <= 1000)

4. Estimate confidence (0.0 to 1.0).

Return ONLY valid JSON matching the schema:
{{
  "regions": [
    {{
      "type": "sentence" | "equation" | "marked-important" | "flowchart" | "diagram",
      "text": "transcription or description",
      "box": {{ "x": 100, "y": 200, "width": 500, "height": 100 }},
      "confidence": 0.95
    }}
  ]
}}"""

    # High-speed active multimodal Gemini models (gemini-3.5-flash-lite delivers ~3s responses with zero 503s)
    models_to_try = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]
    last_err = None
    response_text = ""

    for model_name in models_to_try:
        try:
            logger.info("Attempting Vision analysis with Gemini model: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )
            response_text = response.text
            if response_text:
                break
        except Exception as e:
            logger.warning("Gemini model %s failed: %s", model_name, e)
            last_err = e

    if not response_text:
        raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")

    data = json.loads(response_text)
    raw_regions = data.get("regions", [])

    type_mapping = {
        "sentence": RegionType.SENTENCE,
        "text": RegionType.SENTENCE,
        "paragraph": RegionType.SENTENCE,
        "bullet": RegionType.SENTENCE,
        "title": RegionType.SENTENCE,
        "heading": RegionType.SENTENCE,
        "equation": RegionType.EQUATION,
        "formula": RegionType.EQUATION,
        "math": RegionType.EQUATION,
        "marked-important": RegionType.MARKED_IMPORTANT,
        "important": RegionType.MARKED_IMPORTANT,
        "highlight": RegionType.MARKED_IMPORTANT,
        "highlighted": RegionType.MARKED_IMPORTANT,
        "starred": RegionType.MARKED_IMPORTANT,
        "underlined": RegionType.MARKED_IMPORTANT,
        "flowchart": RegionType.FLOWCHART,
        "flow": RegionType.FLOWCHART,
        "process": RegionType.FLOWCHART,
        "diagram": RegionType.DIAGRAM,
        "drawing": RegionType.DIAGRAM,
        "sketch": RegionType.DIAGRAM,
        "figure": RegionType.DIAGRAM,
        "graph": RegionType.DIAGRAM,
    }

    regions: List[Region] = []
    for idx, item in enumerate(raw_regions):
        rtype_str = str(item.get("type", "sentence")).lower().strip()
        rtype = type_mapping.get(rtype_str, RegionType.SENTENCE)

        text = str(item.get("text", "")).strip()

        # Enforce equation classification for any mathematical formulas or expressions
        from backend.services.ocr_service import is_equation_text
        if is_equation_text(text):
            rtype = RegionType.EQUATION
        if not text:
            if rtype == RegionType.DIAGRAM:
                text = "Handwritten diagram or visual structure"
            elif rtype == RegionType.FLOWCHART:
                text = "Flowchart step sequence"
            elif rtype == RegionType.EQUATION:
                text = "Mathematical formula"
            else:
                text = "[Handwritten note passage]"

        raw_box = item.get("box", [0, 0, width, height])
        box = normalize_box_1000(raw_box, width=width, height=height)

        try:
            conf = float(item.get("confidence", 0.95))
            conf = max(0.0, min(1.0, conf))
        except (ValueError, TypeError):
            conf = 0.95

        regions.append(
            Region(
                chunk_id=f"page-{page}-region-{idx+1}",
                page=page,
                type=rtype,
                text=text,
                box=box,
                confidence=round(conf, 3)
            )
        )

    return regions


def analyze_with_openai(image_path: str, page: int, width: int, height: int, mime_type: str) -> List[Region]:
    """Call OpenAI Vision API."""
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)

    with open(image_path, "rb") as f:
        b64_image = base64.b64encode(f.read()).decode("utf-8")

    data_url = f"data:{mime_type};base64,{b64_image}"

    prompt = f"""You are an expert AI vision assistant specialized in analyzing student handwritten study notes.
Image dimensions: width={width}px, height={height}px.

Detect all regions in the image:
Classify each into one of: 'sentence', 'equation', 'marked-important', 'flowchart', 'diagram'.
Transcribe text accurately (or describe visual diagrams/flowcharts).
Return pixel bounding box [left, top, right, bottom] where 0 <= left < right <= {width} and 0 <= top < bottom <= {height}.
Return JSON object: {{"regions": [{{"type": "sentence", "text": "...", "box": [0,0,10,10], "confidence": 0.95}}]}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        temperature=0.1,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    )

    content = response.choices[0].message.content
    data = json.loads(content)
    raw_regions = data.get("regions", [])

    regions: List[Region] = []
    for idx, item in enumerate(raw_regions):
        rtype_str = item.get("type", "sentence").lower().strip()
        try:
            rtype = RegionType(rtype_str)
        except ValueError:
            rtype = RegionType.SENTENCE

        text = item.get("text", "").strip()
        raw_box = item.get("box", [0, 0, width, height])
        box = normalize_box_1000(raw_box, width=width, height=height)
        conf = float(item.get("confidence", 0.95))

        regions.append(
            Region(
                chunk_id=f"page-{page}-region-{idx+1}",
                page=page,
                type=rtype,
                text=text,
                box=box,
                confidence=round(conf, 3)
            )
        )

    return regions


def analyze_note_image(image_path: str, page: int = 1) -> Tuple[List[Region], str]:
    """
    Main entry point for note vision analysis.
    Tries configured Vision LLM (Gemini or OpenAI).
    Falls back gracefully to OCR if Vision LLM is unconfigured or fails.
    Uses SHA-256 image content cache for instant sub-millisecond repeated analysis.
    Returns (regions, provider_name).
    """
    width, height, mime_type = get_image_info(image_path)
    regions: List[Region] = []
    provider = "ocr-fallback"

    # Check cache first
    file_hash = None
    try:
        file_hash = get_file_sha256(image_path)
        if file_hash in _ANALYSIS_CACHE:
            cached_regions, cached_provider = _ANALYSIS_CACHE[file_hash]
            logger.info("Serving cached vision analysis for page %d (hash: %s...)", page, file_hash[:8])
            remapped_regions = [
                Region(
                    chunk_id=f"page-{page}-region-{idx+1}",
                    page=page,
                    type=r.type,
                    text=r.text,
                    box=r.box,
                    confidence=r.confidence,
                )
                for idx, r in enumerate(cached_regions)
            ]
            return remapped_regions, cached_provider
    except Exception as hash_err:
        logger.debug("Image hashing failed: %s", hash_err)
        file_hash = None

    # 1. Try Gemini if configured
    if config.GEMINI_API_KEY and (config.VISION_PROVIDER == "gemini" or not config.OPENAI_API_KEY):
        try:
            logger.info("Analyzing page %d with Google Gemini Vision...", page)
            regions = analyze_with_gemini(image_path, page, width, height, mime_type)
            if regions:
                provider = "gemini"
        except Exception as exc:
            logger.warning("Gemini Vision analysis failed: %s. Trying fallbacks...", exc)

    # 2. Try OpenAI if configured
    if config.OPENAI_API_KEY and (config.VISION_PROVIDER == "openai" or not regions):
        try:
            logger.info("Analyzing page %d with OpenAI Vision...", page)
            regions = analyze_with_openai(image_path, page, width, height, mime_type)
            if regions:
                provider = "openai"
        except Exception as exc:
            logger.warning("OpenAI Vision analysis failed: %s. Falling back to OCR...", exc)

    # 3. Fallback to OCR (EasyOCR / OpenCV layout)
    if not regions:
        logger.info("Using OCR fallback for page %d analysis...", page)
        ocr_chunks = run_ocr(image_path, page=page)
        regions = ocr_chunks_to_regions(ocr_chunks, page=page, width=width, height=height)
        provider = "ocr-fallback"

    # Enforce equation classification across all regions
    from backend.services.ocr_service import is_equation_text
    for r in regions:
        if is_equation_text(r.text):
            r.type = RegionType.EQUATION

    # Store in cache
    if file_hash and regions:
        _ANALYSIS_CACHE[file_hash] = (regions, provider)

    return regions, provider


def analyze_full_pdf_document(pdf_path: str, page_records: list):
    """
    Lightning-Fast Native PDF Processing.
    Uses Gemini Vision in parallel for exact sentence-level and equation-level region detection.
    Falls back to line-merged OCR with exact pixel dimensions if unconfigured.
    """
    from backend.schemas import (
        StudyAid,
        StudySection,
        EquationBreakdown,
        DiagramExplanation,
        QuizQuestion,
        QuizQuestionType,
        PdfPageData,
    )

    from concurrent.futures import ThreadPoolExecutor

    # 1. Detect regions with Gemini Vision in parallel across pages
    pages_data = []
    page_to_regions = {}

    def process_page_vision(prec):
        try:
            regs, prov = analyze_note_image(prec.file_path, page=prec.page)
            if regs:
                return prec.page, regs
        except Exception as e:
            logger.warning("Vision analysis failed for PDF page %d: %s. Using OCR fallback.", prec.page, e)

        try:
            chunks = run_ocr(prec.file_path, page=prec.page)
            return prec.page, ocr_chunks_to_regions(chunks, page=prec.page, width=prec.width, height=prec.height)
        except Exception:
            return prec.page, []

    workers = min(6, max(1, len(page_records)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        vision_results = list(executor.map(process_page_vision, page_records))

    for page_num, p_regs in vision_results:
        page_to_regions[page_num] = p_regs

    for prec in page_records:
        pages_data.append(
            PdfPageData(
                page=prec.page,
                filename=prec.filename,
                width=prec.width,
                height=prec.height,
                regions=page_to_regions.get(prec.page, [])
            )
        )

    # 2. Native Multimodal Gemini Call in ONE shot
    study_aid = None
    quiz = []

    if config.GEMINI_API_KEY:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=config.GEMINI_API_KEY)
        file_size = Path(pdf_path).stat().st_size

        # Use Files API for files > 15MB to prevent connection drops, Part.from_bytes for smaller
        if file_size > 15 * 1024 * 1024:
            logger.info("PDF size is %.2f MB (>15MB). Uploading via Gemini Files API...", file_size / (1024 * 1024))
            pdf_content = client.files.upload(file=pdf_path)
        else:
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            pdf_content = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")

        prompt = f"""You are an expert AI study assistant analyzing an entire student handwritten study note document ({len(page_records)} pages).
Analyze this complete document in one go and extract:
1. "summary": A concise 2-3 sentence overview of the notes.
2. "sections": List of key concept objects: [{{"title": str, "content": str, "page": int, "importance": "high"|"normal"}}]
3. "equations": List of equation objects: [{{"equation": str, "page": int, "meaning": str, "step_by_step": list[str]}}]
4. "diagrams": List of diagrams, figures, or flowcharts: [{{"title": str, "page": int, "verbal_description": str, "key_components": list[str]}}]
5. "quiz": List of 4-6 quiz question objects: [{{"id": "q1", "type": "mcq"|"short_answer", "question": str, "options": list[str], "correct_answer": str, "explanation": str, "page": int}}]

Return ONLY a valid JSON object adhering strictly to this schema."""

        models_to_try = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]

        for model_name in models_to_try:
            try:
                logger.info("Attempting full document AI analysis with model: %s", model_name)
                res = client.models.generate_content(
                    model=model_name,
                    contents=[pdf_content, prompt],
                    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
                )
                data = json.loads(res.text)

                # Build StudyAid sections
                sections = [
                    StudySection(
                        title=s.get("title", "Key Concept"),
                        content=s.get("content", ""),
                        source_chunk_ids=[f"p{s.get('page', 1)}_c1"],
                        importance=s.get("importance", "normal")
                    )
                    for s in data.get("sections", [])
                ]

                # Build Equations
                eqs = []
                for eq in data.get("equations", []):
                    p_num = eq.get("page", 1)
                    first_reg = page_to_regions.get(p_num, [None])[0]
                    eqs.append(
                        EquationBreakdown(
                            equation=eq.get("equation", ""),
                            source_chunk_id=first_reg.chunk_id if first_reg else f"p{p_num}_c1",
                            source_page=p_num,
                            source_box=first_reg.box if first_reg else [0, 0, 100, 100],
                            step_by_step=eq.get("step_by_step", []),
                            meaning=eq.get("meaning", "")
                        )
                    )

                # Build Diagrams
                diags = []
                for d in data.get("diagrams", []):
                    p_num = d.get("page", 1)
                    first_reg = page_to_regions.get(p_num, [None])[0]
                    diags.append(
                        DiagramExplanation(
                            title=d.get("title", "Diagram"),
                            source_chunk_id=first_reg.chunk_id if first_reg else f"p{p_num}_c1",
                            source_page=p_num,
                            source_box=first_reg.box if first_reg else [0, 0, 100, 100],
                            verbal_description=d.get("verbal_description", ""),
                            key_components=d.get("key_components", [])
                        )
                    )

                study_aid = StudyAid(
                    summary=data.get("summary", "Summary of handwritten notes."),
                    sections=sections,
                    equation_breakdowns=eqs,
                    diagram_explanations=diags
                )

                # Build Quiz with accurate region matching
                for idx, q_item in enumerate(data.get("quiz", [])):
                    p_num = q_item.get("page", 1)
                    page_regs = page_to_regions.get(p_num, [])
                    best_reg = None
                    if page_regs:
                        target_words = set(re.findall(r"\w+", (q_item.get("question", "") + " " + q_item.get("correct_answer", "")).lower()))
                        best_overlap = -1
                        for r in page_regs:
                            r_words = set(re.findall(r"\w+", (r.text or "").lower()))
                            overlap = len(target_words & r_words)
                            if overlap > best_overlap:
                                best_overlap = overlap
                                best_reg = r
                    if not best_reg and page_regs:
                        best_reg = page_regs[0]

                    q_type = QuizQuestionType.MCQ if q_item.get("type") == "mcq" else QuizQuestionType.SHORT_ANSWER
                    quiz.append(
                        QuizQuestion(
                            id=q_item.get("id", f"q{idx+1}"),
                            type=q_type,
                            question=q_item.get("question", ""),
                            options=q_item.get("options"),
                            correct_answer=q_item.get("correct_answer", ""),
                            explanation=q_item.get("explanation", ""),
                            source_chunk_id=best_reg.chunk_id if best_reg else f"p{p_num}_c1",
                            source_page=p_num,
                            source_box=best_reg.box if best_reg else [0, 0, 100, 100]
                        )
                    )
                logger.info("Single-call PDF analysis successful with %s! Extracted summary, %d equations, and %d quiz questions.", model_name, len(eqs), len(quiz))
                break
            except Exception as exc:
                logger.warning("Single-call PDF analysis failed with %s: %s", model_name, exc)

    return study_aid, quiz, pages_data
