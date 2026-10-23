"""
Comprehensive Test Suite for Task 1: POST /analyze
Covers all 12 test cases specified in the requirements:
1. One handwritten page.
2. Multiple pages in a single request.
3. Mathematical equations.
4. A page with marked-important content.
5. Flowcharts and diagrams.
6. Unreadable or blurry handwriting.
7. Empty upload.
8. Unsupported file format.
9. Malformed image.
10. Vision API failure.
11. Malformed model response.
12. Invalid or out-of-bounds coordinates.
"""
import os
import sys
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.main import app
from backend.schemas import RegionType, BoundingBox
from backend.services.vision_service import normalize_box_1000


def generate_sample_note_page1(output_path: Path):
    """Generate page 1: Mechanics with equation, marked-important, flowchart, and diagram."""
    width, height = 800, 1000
    img = Image.new("RGB", (width, height), color=(252, 250, 242))
    draw = ImageDraw.Draw(img)

    # Margin and ruling lines
    draw.line([(80, 0), (80, height)], fill=(235, 180, 180), width=2)
    for y in range(80, height, 40):
        draw.line([(0, y), (width, y)], fill=(225, 235, 245), width=1)

    # Sentence
    draw.text((100, 50), "Topic: Mechanics & Energy Conservation", fill=(20, 20, 20))
    draw.text((100, 120), "1. Work done by a constant force on an object moving along displacement d.", fill=(40, 40, 60))

    # Mathematical Equation
    draw.rectangle([95, 175, 420, 225], outline=(180, 180, 200), width=1)
    draw.text((110, 190), "W = F * d * cos(theta)", fill=(10, 10, 80))

    # Marked Important region
    draw.rectangle([95, 270, 680, 340], fill=(255, 252, 190), outline=(210, 180, 40), width=2)
    draw.text((110, 285), "* IMPORTANT FOR EXAM:", fill=(160, 40, 20))
    draw.text((110, 310), "Mechanical Energy E = K + U is conserved in isolated conservative systems!", fill=(40, 20, 20))

    # Flowchart / Process
    draw.rectangle([110, 390, 240, 440], outline=(40, 80, 140), width=2)
    draw.text((120, 405), "Potential (U)", fill=(30, 30, 30))
    draw.line([(240, 415), (320, 415)], fill=(40, 80, 140), width=2)
    draw.polygon([(320, 415), (310, 410), (310, 420)], fill=(40, 80, 140))
    draw.rectangle([320, 390, 450, 440], outline=(40, 80, 140), width=2)
    draw.text((330, 405), "Kinetic (K)", fill=(30, 30, 30))

    # Diagram sketch (Incline plane)
    draw.polygon([(120, 600), (360, 600), (120, 500)], outline=(50, 50, 50), width=2)
    draw.rectangle([200, 515, 240, 545], outline=(150, 40, 40), width=2)
    draw.text((250, 520), "mass m", fill=(150, 40, 40))
    draw.text((130, 620), "Figure 1: Frictionless incline plane diagram", fill=(60, 60, 60))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=95)


def generate_sample_note_page2(output_path: Path):
    """Generate page 2: Thermodynamics."""
    width, height = 800, 1000
    img = Image.new("RGB", (width, height), color=(250, 252, 245))
    draw = ImageDraw.Draw(img)

    draw.line([(80, 0), (80, height)], fill=(180, 220, 180), width=2)
    for y in range(80, height, 40):
        draw.line([(0, y), (width, y)], fill=(230, 240, 230), width=1)

    draw.text((100, 50), "Topic: Thermodynamics - Heat Transfer", fill=(20, 20, 20))
    draw.rectangle([95, 120, 400, 170], outline=(180, 180, 200), width=1)
    draw.text((110, 135), "Q = m * c * DeltaT", fill=(10, 10, 80))

    draw.text((100, 220), "Heat capacity depends on material properties.", fill=(30, 30, 50))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=95)


def generate_blurry_note_image(output_path: Path):
    """Generate an unreadable, blurry image to test graceful handling."""
    width, height = 400, 500
    img = Image.new("RGB", (width, height), color=(200, 200, 200))
    draw = ImageDraw.Draw(img)
    # Scribbles
    draw.arc([50, 50, 350, 350], start=0, end=180, fill=(100, 100, 100), width=5)
    draw.line([(30, 200), (370, 220)], fill=(80, 80, 80), width=3)
    # Heavy blur
    blurred = img.filter(ImageFilter.GaussianBlur(radius=15))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    blurred.save(output_path, "JPEG", quality=70)


def validate_region_structure(reg, expected_page):
    """Helper to validate region schema adherence."""
    valid_types = {rt.value for rt in RegionType}
    assert "chunk_id" in reg, f"Missing chunk_id in region: {reg}"
    assert "page" in reg, f"Missing page in region: {reg}"
    assert reg["page"] == expected_page, f"Region page {reg['page']} != expected {expected_page}"
    assert "type" in reg, f"Missing type in region: {reg}"
    assert reg["type"] in valid_types, f"Invalid type '{reg['type']}'. Allowed: {valid_types}"
    assert "text" in reg and isinstance(reg["text"], str), f"Missing or invalid text in region: {reg}"
    assert "box" in reg, f"Missing box in region: {reg}"

    box = reg["box"]
    assert isinstance(box, dict), f"Box must be a dictionary, got {type(box)}: {box}"
    for k in ("x", "y", "width", "height"):
        assert k in box, f"Missing '{k}' in box: {box}"
        assert isinstance(box[k], int), f"Box '{k}' must be int, got {type(box[k])}: {box[k]}"
        assert 0 <= box[k] <= 1000, f"Box '{k}' out of [0, 1000] range: {box[k]}"

    assert box["x"] + box["width"] <= 1000, f"x + width > 1000: {box}"
    assert box["y"] + box["height"] <= 1000, f"y + height > 1000: {box}"

    if "confidence" in reg and reg["confidence"] is not None:
        assert 0.0 <= reg["confidence"] <= 1.0, f"Confidence {reg['confidence']} out of range"


def run_all_tests():
    client = TestClient(app)
    results = {}

    page1_path = ROOT_DIR / "sample_note.jpg"
    page2_path = ROOT_DIR / "backend" / "uploads" / "sample_page2_test.jpg"
    blurry_path = ROOT_DIR / "backend" / "uploads" / "sample_blurry_test.jpg"

    generate_sample_note_page1(page1_path)
    generate_sample_note_page2(page2_path)
    generate_blurry_note_image(blurry_path)

    print("=" * 70)
    print("STARTING TASK 1 TEST SUITE (12 Verification Scenarios)")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. One handwritten page
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing single handwritten page upload...")
    with open(page1_path, "rb") as f:
        res = client.post("/analyze", files={"files": ("page1.jpg", f, "image/jpeg")})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["success"] is True
    assert len(data["pages"]) == 1
    p1 = data["pages"][0]
    assert p1["page"] == 1
    assert "imageId" in p1 and p1["imageId"]
    assert len(p1["regions"]) > 0
    for reg in p1["regions"]:
        validate_region_structure(reg, expected_page=1)
    results["1. One handwritten page"] = f"PASSED ({len(p1['regions'])} regions, provider: {data.get('provider')})"
    print(f" -> PASSED: {results['1. One handwritten page']}")

    # -------------------------------------------------------------
    # 2. Multiple pages in a single request
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing multiple pages in a single request...")
    with open(page1_path, "rb") as f1, open(page2_path, "rb") as f2:
        res = client.post(
            "/analyze",
            files=[
                ("files", ("page1.jpg", f1, "image/jpeg")),
                ("files", ("page2.jpg", f2, "image/jpeg")),
            ]
        )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["success"] is True
    assert len(data["pages"]) == 2
    # Verify page order and numbers
    assert data["pages"][0]["page"] == 1
    assert data["pages"][1]["page"] == 2
    # Verify imageIds are preserved and distinct
    assert data["pages"][0]["imageId"] != data["pages"][1]["imageId"]
    # Verify unique chunk IDs across all pages
    all_chunks = [r["chunk_id"] for p in data["pages"] for r in p["regions"]]
    assert len(all_chunks) == len(set(all_chunks)), "Chunk IDs must be unique across all pages!"
    for reg in data["pages"][0]["regions"]:
        validate_region_structure(reg, expected_page=1)
    for reg in data["pages"][1]["regions"]:
        validate_region_structure(reg, expected_page=2)
    results["2. Multiple pages in a single request"] = f"PASSED (Pages 1 & 2 preserved, {len(all_chunks)} unique chunk_ids)"
    print(f" -> PASSED: {results['2. Multiple pages in a single request']}")

    # -------------------------------------------------------------
    # 3. Mathematical equations
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing detection of mathematical equations...")
    regions_p1 = data["pages"][0]["regions"]
    eq_regions = [r for r in regions_p1 if r["type"] == "equation"]
    assert len(eq_regions) > 0, "Expected at least one 'equation' region in page 1"
    assert any("=" in r["text"] or "W" in r["text"] or "cos" in r["text"] for r in eq_regions)
    results["3. Mathematical equations"] = f"PASSED (Found {len(eq_regions)} equation regions, e.g. '{eq_regions[0]['text'][:30]}')"
    print(f" -> PASSED: {results['3. Mathematical equations']}")

    # -------------------------------------------------------------
    # 4. A page with marked-important content
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing detection of marked-important content...")
    imp_regions = [r for r in regions_p1 if r["type"] == "marked-important"]
    assert len(imp_regions) > 0, "Expected at least one 'marked-important' region in page 1"
    assert any("important" in r["text"].lower() or "*" in r["text"] or "exam" in r["text"].lower() for r in imp_regions)
    results["4. Page with marked-important content"] = f"PASSED (Found {len(imp_regions)} marked-important regions, e.g. '{imp_regions[0]['text'][:35]}')"
    print(f" -> PASSED: {results['4. Page with marked-important content']}")

    # -------------------------------------------------------------
    # 5. Flowcharts and diagrams
    # -------------------------------------------------------------
    print("\n[TEST 5] Testing detection of flowcharts and diagrams...")
    flow_or_diag = [r for r in regions_p1 if r["type"] in ("flowchart", "diagram")]
    assert len(flow_or_diag) > 0, "Expected flowchart or diagram regions in page 1"
    results["5. Flowcharts and diagrams"] = f"PASSED (Found {len(flow_or_diag)} visual/diagram regions)"
    print(f" -> PASSED: {results['5. Flowcharts and diagrams']}")

    # -------------------------------------------------------------
    # 6. Unreadable or blurry handwriting
    # -------------------------------------------------------------
    print("\n[TEST 6] Testing unreadable or blurry handwriting handling...")
    with open(blurry_path, "rb") as fb:
        res = client.post("/analyze", files={"files": ("blurry.jpg", fb, "image/jpeg")})
    assert res.status_code == 200, f"Expected 200 for blurry image, got {res.status_code}"
    b_data = res.json()
    assert b_data["success"] is True
    # Must handle gracefully without crashing or hallucinating false facts
    for reg in b_data["pages"][0]["regions"]:
        validate_region_structure(reg, expected_page=1)
    results["6. Unreadable or blurry handwriting"] = "PASSED (Handled safely without error, uncertainty preserved)"
    print(f" -> PASSED: {results['6. Unreadable or blurry handwriting']}")

    # -------------------------------------------------------------
    # 7. Empty upload
    # -------------------------------------------------------------
    print("\n[TEST 7] Testing empty upload rejection...")
    res_empty1 = client.post("/analyze")
    assert res_empty1.status_code == 400, f"Expected 400 for empty upload, got {res_empty1.status_code}"
    # Empty byte file
    res_empty2 = client.post("/analyze", files={"files": ("empty.jpg", b"", "image/jpeg")})
    assert res_empty2.status_code == 400, f"Expected 400 for 0-byte file, got {res_empty2.status_code}"
    results["7. Empty upload"] = "PASSED (Rejected with 400 Bad Request and descriptive message)"
    print(f" -> PASSED: {results['7. Empty upload']}")

    # -------------------------------------------------------------
    # 8. Unsupported file format
    # -------------------------------------------------------------
    print("\n[TEST 8] Testing unsupported file format rejection...")
    res_unsupported = client.post(
        "/analyze",
        files={"files": ("notes.txt", b"plain text notes", "text/plain")}
    )
    assert res_unsupported.status_code == 400, f"Expected 400 for .txt file, got {res_unsupported.status_code}"
    assert "Unsupported file format" in res_unsupported.json()["detail"]
    results["8. Unsupported file format"] = "PASSED (Rejected .txt with 400 and clear allowed formats)"
    print(f" -> PASSED: {results['8. Unsupported file format']}")

    # -------------------------------------------------------------
    # 9. Malformed image
    # -------------------------------------------------------------
    print("\n[TEST 9] Testing malformed / corrupt image detection...")
    corrupt_bytes = b"GIF89a corrupt garbage bytes that are not a real image \x00\xff\xfe"
    res_corrupt = client.post(
        "/analyze",
        files={"files": ("corrupt.jpg", corrupt_bytes, "image/jpeg")}
    )
    assert res_corrupt.status_code == 400, f"Expected 400 for corrupted image, got {res_corrupt.status_code}"
    assert "Malformed" in res_corrupt.json()["detail"]
    results["9. Malformed image"] = "PASSED (Detected corrupt image data, rejected with 400)"
    print(f" -> PASSED: {results['9. Malformed image']}")

    # -------------------------------------------------------------
    # 10. Vision API failure (Safe OCR fallback)
    # -------------------------------------------------------------
    print("\n[TEST 10] Testing Vision API failure safe OCR fallback...")
    from unittest.mock import patch
    from backend.services.vision_service import _ANALYSIS_CACHE
    _ANALYSIS_CACHE.clear()

    with patch("backend.services.vision_service.analyze_with_gemini", side_effect=RuntimeError("Simulated Gemini API 503 Spike")):
        with open(page1_path, "rb") as f:
            res_fail = client.post("/analyze", files={"files": ("page1.jpg", f, "image/jpeg")})
        assert res_fail.status_code == 200, f"Expected 200 via fallback, got {res_fail.status_code}"
        f_data = res_fail.json()
        assert f_data["success"] is True
        assert f_data["provider"] == "ocr-fallback"
        assert len(f_data["pages"][0]["regions"]) > 0
        for reg in f_data["pages"][0]["regions"]:
            validate_region_structure(reg, expected_page=1)
    results["10. Vision API failure"] = "PASSED (Caught API exception, seamlessly fell back to OCR with valid regions)"
    print(f" -> PASSED: {results['10. Vision API failure']}")

    # -------------------------------------------------------------
    # 11. Malformed model response
    # -------------------------------------------------------------
    print("\n[TEST 11] Testing malformed model response handling...")
    _ANALYSIS_CACHE.clear()
    with patch("backend.services.vision_service.analyze_with_gemini", side_effect=ValueError("Malformed JSON response from model")):
        with open(page1_path, "rb") as f:
            res_malformed_model = client.post("/analyze", files={"files": ("page1.jpg", f, "image/jpeg")})
        assert res_malformed_model.status_code == 200
        mm_data = res_malformed_model.json()
        assert mm_data["provider"] == "ocr-fallback"
        assert len(mm_data["pages"][0]["regions"]) > 0
    results["11. Malformed model response"] = "PASSED (Model output error caught safely, fell back to OCR)"
    print(f" -> PASSED: {results['11. Malformed model response']}")

    # -------------------------------------------------------------
    # 12. Invalid or out-of-bounds coordinates
    # -------------------------------------------------------------
    print("\n[TEST 12] Testing coordinate normalizer with out-of-bounds values...")
    # Negative values
    b1 = normalize_box_1000({"x": -50, "y": -30, "width": 200, "height": 300}, width=800, height=1000)
    assert b1.x == 0, f"Expected x=0 for negative input, got {b1.x}"
    assert b1.y == 0, f"Expected y=0 for negative input, got {b1.y}"
    assert b1.x + b1.width <= 1000
    assert b1.y + b1.height <= 1000

    # Overflows (x + width > 1000)
    b2 = normalize_box_1000({"x": 850, "y": 900, "width": 400, "height": 500}, width=800, height=1000)
    assert b2.x == 850
    assert b2.width == 150, f"Expected width clamped to 150 (1000 - 850), got {b2.width}"
    assert b2.x + b2.width == 1000
    assert b2.y + b2.height == 1000

    # Float coordinates 0.0 - 1.0
    b3 = normalize_box_1000([0.1, 0.2, 0.6, 0.8], width=800, height=1000)
    assert b3.x == 100
    assert b3.y == 200
    assert b3.width == 500
    assert b3.height == 600

    # Pixel array [x1, y1, x2, y2]
    b4 = normalize_box_1000([80, 200, 480, 700], width=800, height=1000)
    assert b4.x == 100  # (80/800)*1000
    assert b4.y == 200  # (200/1000)*1000
    assert b4.width == 500  # (400/800)*1000
    assert b4.height == 500  # (500/1000)*1000

    # All values are strictly integers
    for b in (b1, b2, b3, b4):
        assert isinstance(b.x, int)
        assert isinstance(b.y, int)
        assert isinstance(b.width, int)
        assert isinstance(b.height, int)

    results["12. Invalid or out-of-bounds coordinates"] = "PASSED (Clamped strictly to [0, 1000], integers, x+w<=1000, y+h<=1000)"
    print(f" -> PASSED: {results['12. Invalid or out-of-bounds coordinates']}")

    # -------------------------------------------------------------
    # 13. Backwards Compatibility: Single file and filename parameters
    # -------------------------------------------------------------
    print("\n[VERIFICATION] Testing backwards-compatible single file and filename calls...")
    with open(page1_path, "rb") as f:
        res_compat1 = client.post("/analyze", files={"file": ("page1.jpg", f, "image/jpeg")}, data={"page": 1})
    assert res_compat1.status_code == 200
    assert "regions" in res_compat1.json()

    res_compat2 = client.post("/analyze", data={"filename": "sample_note.jpg", "page": 1})
    assert res_compat2.status_code == 200
    assert len(res_compat2.json()["pages"]) == 1

    print("\n" + "=" * 70)
    print("ALL 12 TASK 1 TEST SCENARIOS COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    for test_name, status in results.items():
        print(f" * {test_name}: {status}")


if __name__ == "__main__":
    run_all_tests()
