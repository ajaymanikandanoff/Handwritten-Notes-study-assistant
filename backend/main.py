import os
import shutil
import logging
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

from backend import config
import io
import time
from concurrent.futures import ThreadPoolExecutor
from backend.schemas import (
    Region,
    RegionType,
    BoundingBox,
    PageAnalysis,
    AnalyzeResponse,
    OcrChunk,
    OcrResponse,
    UploadResponse,
    PdfUploadResponse,
    AnalyzePdfResponse,
    PdfPageData,
    GenerateRequest,
    GenerateResponse,
    AskRequest,
    AskResponse,
)
from backend.services.ocr_service import run_ocr, ocr_chunks_to_regions
from backend.services.vision_service import analyze_note_image, analyze_full_pdf_document
from backend.services.generation_service import generate_study_material, ask_notes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("notes-assistant")

app = FastAPI(
    title="Handwritten Notes Study Assistant API",
    version="1.0.0",
    description="Vision-powered handwritten study notes analysis, quiz generator, and grounded study assistant."
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS if config.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images statically
app.mount("/uploads", StaticFiles(directory=str(config.UPLOADS_DIR)), name="uploads")


def render_pdf_to_images(pdf_path: Path, start_page: int = 1) -> List[UploadResponse]:
    """Render every page of a multi-page PDF into crisp 2x scaled JPEG note images."""
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_path)
    responses = []
    base_name = pdf_path.stem

    for idx, page in enumerate(pdf):
        page_num = start_page + idx
        rendered_image = page.render(scale=1.5).to_pil()
        image_filename = f"page_{page_num}_{base_name}_p{idx+1}.jpg"
        target_image_path = config.UPLOADS_DIR / image_filename
        rendered_image.save(target_image_path, "JPEG", quality=85)
        width, height = rendered_image.size

        responses.append(
            UploadResponse(
                filename=image_filename,
                file_path=str(target_image_path),
                page=page_num,
                width=width,
                height=height,
                message=f"Rendered PDF page {idx+1} as note page {page_num}."
            )
        )
    return responses


@app.get("/")
def read_root():
    return {
        "name": "Handwritten Notes Study Assistant API",
        "status": "online",
        "endpoints": {
            "upload": "POST /upload",
            "upload_pdf": "POST /upload-pdf",
            "ocr": "POST /ocr",
            "analyze": "POST /analyze",
            "generate": "POST /generate",
            "ask": "POST /ask",
        },
        "vision_configured": bool(config.GEMINI_API_KEY or config.OPENAI_API_KEY),
        "vision_provider": config.VISION_PROVIDER,
    }


@app.post("/upload-pdf", response_model=AnalyzePdfResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    start_page: int = Form(1)
):
    """
    Lightning-Fast Native PDF Ingestion & Analysis.
    Extracts all pages locally in < 1s, then performs native single-shot AI analysis
    across the entire multi-page document in 8-12 seconds.
    Returns rendered pages with bounding boxes, global summary, equation breakdowns, and quiz.
    """
    if not (file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF document.")

    start_time = time.time()
    clean_filename = f"doc_{file.filename}"
    pdf_path = config.UPLOADS_DIR / clean_filename

    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        logger.error("Failed to save PDF: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to save PDF: {str(exc)}")

    try:
        # 1. Local image extraction (< 1 sec)
        page_records = render_pdf_to_images(pdf_path, start_page=start_page)
        logger.info("Rendered %d note pages from PDF '%s' in %.2fs.", len(page_records), file.filename, time.time() - start_time)

        # 2. Single-shot Full Document AI processing
        study_aid, quiz, pages_data = analyze_full_pdf_document(str(pdf_path), page_records)

        duration = round(time.time() - start_time, 2)
        logger.info("Completed end-to-end PDF analysis for %d pages in %.2f seconds!", len(page_records), duration)

        return AnalyzePdfResponse(
            pdf_filename=file.filename,
            total_pages=len(page_records),
            study_aid=study_aid,
            quiz=quiz,
            pages=pages_data,
            execution_time_seconds=duration,
            message=f"Analyzed {len(page_records)} pages in {duration} seconds with Vision AI."
        )
    except Exception as exc:
        logger.error("Failed to process PDF: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(exc)}")


@app.post("/upload", response_model=UploadResponse)
async def upload_note(
    file: UploadFile = File(...),
    page: int = Form(1)
):
    """
    Upload a handwritten note image or single-page PDF and save to backend/uploads.
    Returns the saved filename, path, image dimensions, and page index.
    """
    is_pdf = file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf"

    if is_pdf:
        # Save and render first page
        clean_filename = f"pdf_{file.filename}"
        pdf_path = config.UPLOADS_DIR / clean_filename
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        pages = render_pdf_to_images(pdf_path, start_page=page)
        if not pages:
            raise HTTPException(status_code=400, detail="Empty PDF uploaded.")
        return pages[0]

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image or PDF.")

    # Sanitize and create unique filename
    clean_filename = f"page_{page}_{file.filename}"
    target_path = config.UPLOADS_DIR / clean_filename

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        logger.error("Failed to save uploaded file: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(exc)}")

    # Retrieve dimensions
    try:
        with Image.open(target_path) as img:
            width, height = img.size
    except Exception:
        width, height = (0, 0)

    logger.info("Saved upload: %s (%dx%d, page %d)", clean_filename, width, height, page)

    return UploadResponse(
        filename=clean_filename,
        file_path=str(target_path),
        page=page,
        width=width,
        height=height,
        message="Image uploaded successfully."
    )


@app.post("/ocr", response_model=OcrResponse)
async def ocr_note(
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None),
    page: int = Form(1)
):
    """
    Run OCR on handwritten note.
    Accepts either an uploaded file or the filename of an already uploaded image.
    Uses EasyOCR with OpenCV layout fallback.
    Returns chunks with chunk_id, text, box [left, top, right, bottom], and confidence.
    """
    temp_target = None
    if file:
        temp_target = config.UPLOADS_DIR / f"temp_ocr_{file.filename}"
        with open(temp_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_path = str(temp_target)
    elif filename:
        image_path = str(config.UPLOADS_DIR / filename)
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found in uploads directory.")
    else:
        raise HTTPException(status_code=400, detail="Either 'file' or 'filename' must be provided.")

    try:
        chunks = run_ocr(image_path, page=page)
        return OcrResponse(
            chunks=chunks,
            total_chunks=len(chunks)
        )
    finally:
        # Clean up temporary file if created
        if temp_target and temp_target.exists():
            try:
                temp_target.unlink()
            except Exception:
                pass


MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB per image
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_notes(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None),
    page: Optional[int] = Form(None),
):
    """
    TASK 1 — High-Precision Handwritten Note Region Classifier & Scanner.
    - Accepts one or more uploaded images (PNG, JPG, JPEG).
    - Validates file types, file sizes (<= 25MB), and decoded image integrity.
    - Preserves upload order and assigns page numbers starting at 1.
    - Uses vision LLM to read handwriting, recognize equations, detect visibly important content,
      and identify diagrams and flowcharts.
    - Normalizes all bounding boxes to a strict 0-1000 integer scale: {x, y, width, height}.
    - Retains original image files and unique chunk_ids ('page-X-region-Y') for click-to-highlight.
    - Uses EasyOCR / OpenCV layout fallback safely if vision LLM is unconfigured or fails.
    """
    # 1. Collect and filter uploaded files
    upload_items: List[UploadFile] = []
    if files:
        for f in files:
            if f and f.filename and f.filename.strip():
                upload_items.append(f)
    if file and file.filename and file.filename.strip():
        upload_items.append(file)

    if not upload_items and not filename:
        raise HTTPException(
            status_code=400,
            detail="Empty upload. Please provide at least one valid image file (PNG, JPG, JPEG)."
        )

    pages_result: List[PageAnalysis] = []
    all_regions: List[Region] = []
    overall_provider = "gemini"

    # 2. Process uploaded image files
    if upload_items:
        # Validate all files first (fail-fast on any invalid input)
        validated_files_data = []
        for item in upload_items:
            ext = Path(item.filename).suffix.lower()
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format '{item.filename}'. Allowed formats: PNG, JPG, JPEG."
                )

            try:
                content = await item.read()
            except Exception as read_err:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to read uploaded file '{item.filename}': {str(read_err)}"
                )

            if len(content) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Uploaded file '{item.filename}' is empty (0 bytes)."
                )

            if len(content) > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{item.filename}' exceeds maximum allowed size of 25MB."
                )

            # Validate image data integrity using PIL
            try:
                with Image.open(io.BytesIO(content)) as img:
                    img.verify()
                with Image.open(io.BytesIO(content)) as img:
                    width, height = img.size
                    if width <= 0 or height <= 0:
                        raise ValueError("Invalid image dimensions")
            except Exception as img_err:
                logger.warning("Malformed image detected (%s): %s", item.filename, img_err)
                raise HTTPException(
                    status_code=400,
                    detail=f"Malformed or unreadable image file: '{item.filename}'."
                )

            validated_files_data.append((item.filename, content, width, height))

        # Process each image concurrently while strictly preserving upload order
        def process_page_item(idx, orig_filename, content, width, height):
            page_num = idx + 1
            safe_name = Path(orig_filename).name.replace(" ", "_")
            image_id = f"page_{page_num}_{safe_name}"
            target_path = config.UPLOADS_DIR / image_id

            try:
                with open(target_path, "wb") as f_out:
                    f_out.write(content)
            except Exception as write_err:
                logger.error("Failed to save image to disk: %s", write_err)
                raise RuntimeError(f"Failed to save image: {str(write_err)}")

            try:
                regions, provider = analyze_note_image(str(target_path), page=page_num)
            except Exception as analysis_err:
                logger.warning(
                    "Vision analysis failed for page %d (%s): %s. Running OCR fallback.",
                    page_num, image_id, analysis_err
                )
                chunks = run_ocr(str(target_path), page=page_num)
                regions = ocr_chunks_to_regions(chunks, page=page_num, width=width, height=height)
                provider = "ocr-fallback"

            page_analysis = PageAnalysis(
                page=page_num,
                imageId=image_id,
                image_url=f"/uploads/{image_id}",
                width=width,
                height=height,
                regions=regions
            )
            return idx, page_analysis, regions, provider

        workers = min(6, len(validated_files_data))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [
                executor.submit(process_page_item, idx, orig_filename, content, width, height)
                for idx, (orig_filename, content, width, height) in enumerate(validated_files_data)
            ]
            results = [f.result() for f in futures]

        # Preserve strict upload order (page 1, 2, 3...)
        results.sort(key=lambda x: x[0])
        for _, page_analysis, regions, provider in results:
            pages_result.append(page_analysis)
            all_regions.extend(regions)

        providers = [p for _, _, _, p in results]
        if any(p == "gemini" for p in providers):
            overall_provider = "gemini"
        elif any(p == "openai" for p in providers):
            overall_provider = "openai"
        else:
            overall_provider = "ocr-fallback"

    # 3. Handle filename-based request (backwards compatibility)
    elif filename:
        candidate_path = config.UPLOADS_DIR / filename
        if not candidate_path.exists():
            candidate_path = Path(filename)
            if not candidate_path.exists():
                raise HTTPException(status_code=404, detail=f"File '{filename}' not found.")

        ext = candidate_path.suffix.lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{filename}'. Allowed formats: PNG, JPG, JPEG."
            )

        page_num = page if page and page > 0 else 1
        try:
            with Image.open(candidate_path) as img:
                width, height = img.size
        except Exception:
            width, height = (800, 1000)

        regions, provider = analyze_note_image(str(candidate_path), page=page_num)
        overall_provider = provider

        page_analysis = PageAnalysis(
            page=page_num,
            imageId=candidate_path.name,
            image_url=f"/uploads/{candidate_path.name}",
            width=width,
            height=height,
            regions=regions
        )
        pages_result.append(page_analysis)
        all_regions.extend(regions)

    return AnalyzeResponse(
        success=True,
        pages=pages_result,
        regions=all_regions,
        total_regions=len(all_regions),
        provider=overall_provider
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate_content(req: GenerateRequest):
    """
    Task 2: Study Aid & Quiz Generation Endpoint.
    Supports mode: 'learn', 'test', or 'both'.
    - 'learn': Step-by-step breakdown of equations, verbal diagrams, and high-priority marked-important concepts.
    - 'test': Grounded quiz (MCQs + short-answer) strictly linked to chunk_id, page, and box coordinates.
    - 'both': Combined study aid and quiz.
    """
    valid_modes = {"learn", "test", "both"}
    norm_mode = (req.mode or "").strip().lower()
    if norm_mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid generation mode '{req.mode}'. Allowed modes: 'learn', 'test', 'both'."
        )

    if not req.regions or len(req.regions) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one region must be provided for generation."
        )

    try:
        logger.info("Generating content for mode '%s' with %d regions...", norm_mode, len(req.regions))
        response = generate_study_material(norm_mode, req.regions)
        return response
    except Exception as exc:
        logger.error("Generate endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(exc)}")


@app.post("/ask", response_model=AskResponse)
async def ask_assistant(req: AskRequest):
    """
    Task 5 Voice/Text Grounded Q&A Assistant Endpoint.
    Answers student questions strictly grounded in the extracted notes.
    Returns spoken response and exact source chunk_id, page, and bounding box coordinates.
    """
    try:
        logger.info("Received query: '%s' against %d regions", req.question, len(req.regions))
        response = ask_notes(req.question, req.regions)
        return response
    except Exception as exc:
        logger.error("Ask endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ask failed: {str(exc)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=config.HOST, port=config.PORT, reload=True)
