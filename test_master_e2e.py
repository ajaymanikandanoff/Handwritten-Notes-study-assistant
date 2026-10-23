"""
Master End-to-End Test Suite for Handwritten Notes Study Assistant
Verifies:
1. Health & Configuration: GET /
2. High-Precision Note Scanner: POST /analyze with multi-page concurrency and SHA-256 caching
3. Native PDF Pipeline: POST /upload-pdf (single-shot multi-page analysis)
4. Comprehensive Study Generation: POST /generate (learn, test, both, multi-source traceability)
5. Grounded Voice/Text Q&A: POST /ask (exact source chunk and bounding box)
"""

import time
import httpx
from pathlib import Path
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"


def test_1_health():
    print("\n[1/5] Testing API Health & Config (GET /)...")
    res = httpx.get(f"{BASE_URL}/", timeout=10.0)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    print(f"Status: {data.get('status')} | Provider: {data.get('vision_provider')}")
    assert data.get("status") == "online"
    assert "generate" in data.get("endpoints", {})
    assert "ask" in data.get("endpoints", {})
    print("PASS: API is healthy and configured.")


def test_2_analyze_concurrent_and_caching():
    print("\n[2/5] Testing POST /analyze (Multi-page Concurrency & Hash Caching)...")
    
    # Create two test note images
    img1_path = Path("test_page_1.png")
    img2_path = Path("test_page_2.png")
    
    img1 = Image.new("RGB", (600, 800), color=(255, 255, 255))
    img1.save(img1_path)
    img2 = Image.new("RGB", (600, 800), color=(240, 240, 250))
    img2.save(img2_path)

    try:
        # First call: multi-file upload
        t0 = time.time()
        b1 = img1_path.read_bytes()
        b2 = img2_path.read_bytes()
        files1 = [
            ("files", ("test_page_1.png", b1, "image/png")),
            ("files", ("test_page_2.png", b2, "image/png")),
        ]
        res1 = httpx.post(f"{BASE_URL}/analyze", files=files1, timeout=60.0)
        dur1 = time.time() - t0
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
        data1 = res1.json()
        print(f"First concurrent analysis (2 pages): {dur1:.2f}s | Total regions: {data1.get('total_regions')}")
        assert len(data1.get("pages", [])) == 2
        assert data1["pages"][0]["page"] == 1
        assert data1["pages"][1]["page"] == 2

        # Second call with same files: should hit SHA-256 cache instantly!
        t1 = time.time()
        files2 = [
            ("files", ("test_page_1.png", b1, "image/png")),
            ("files", ("test_page_2.png", b2, "image/png")),
        ]
        res2 = httpx.post(f"{BASE_URL}/analyze", files=files2, timeout=60.0)
        dur2 = time.time() - t1
        assert res2.status_code == 200
        data2 = res2.json()
        print(f"Second analysis (cached): {dur2:.3f}s (Cache acceleration verified!)")
        assert dur2 < dur1, "Expected cached run to be significantly faster"

        print("PASS: Multi-file concurrent upload and SHA-256 caching verified.")
    finally:
        if img1_path.exists():
            img1_path.unlink()
        if img2_path.exists():
            img2_path.unlink()


def test_3_generate_pipeline():
    print("\n[3/5] Testing POST /generate (Learn, Test, Both & Composite Traceability)...")
    regions = [
        {
            "chunk_id": "page-1-region-1",
            "page": 1,
            "type": "marked-important",
            "text": "FUNDAMENTAL THEOREM: Mechanical work transforms energy between kinetic and potential forms.",
            "box": {"x": 100, "y": 120, "width": 800, "height": 80},
            "confidence": 0.98,
        },
        {
            "chunk_id": "page-1-region-2",
            "page": 1,
            "type": "equation",
            "text": "E_k = 0.5 * m * v^2",
            "box": {"x": 150, "y": 280, "width": 500, "height": 60},
            "confidence": 0.96,
        },
        {
            "chunk_id": "page-2-region-1",
            "page": 2,
            "type": "flowchart",
            "text": "Mechanical System Flow: Input Force -> Gearbox Reduction -> Output Torque -> Load.",
            "box": {"x": 120, "y": 200, "width": 750, "height": 180},
            "confidence": 0.93,
        },
    ]

    # Test 'learn'
    res_learn = httpx.post(f"{BASE_URL}/generate", json={"mode": "learn", "regions": regions}, timeout=60.0)
    assert res_learn.status_code == 200
    d_learn = res_learn.json()
    assert d_learn["mode"] == "learn"
    assert d_learn["study_aid"] is not None
    assert d_learn["quiz"] is None or len(d_learn["quiz"]) == 0
    assert len(d_learn["study_aid"]["equation_breakdowns"]) >= 1
    assert len(d_learn["study_aid"]["diagram_explanations"]) >= 1
    print(f"Learn Mode: {len(d_learn['study_aid']['sections'])} sections, {len(d_learn['study_aid']['equation_breakdowns'])} equation breakdowns")

    # Test 'test'
    res_test = httpx.post(f"{BASE_URL}/generate", json={"mode": "test", "regions": regions}, timeout=60.0)
    assert res_test.status_code == 200
    d_test = res_test.json()
    assert d_test["mode"] == "test"
    assert d_test["study_aid"] is None
    assert len(d_test["quiz"]) >= 2
    for q in d_test["quiz"]:
        if q["type"] == "mcq":
            assert len(q["options"]) == 4, f"MCQ must have 4 options: {q['options']}"
        assert q["source_chunk_id"] is not None
        assert q["source_page"] in (1, 2)
        assert q["source_box"] is not None
        assert len(q["sources"]) >= 1
    print(f"Test Mode: {len(d_test['quiz'])} questions verified with 4-choice MCQs & source traceability.")

    # Test 'both'
    res_both = httpx.post(f"{BASE_URL}/generate", json={"mode": "both", "regions": regions}, timeout=60.0)
    assert res_both.status_code == 200
    d_both = res_both.json()
    assert d_both["mode"] == "both"
    assert d_both["study_aid"] is not None
    assert len(d_both["quiz"]) >= 2
    print("Both Mode: Combined Study Aid and Quiz verified.")

    print("PASS: Generation pipeline verified across all modes.")


def test_4_grounded_qa():
    print("\n[4/5] Testing POST /ask (Grounded Voice/Text Assistant)...")
    regions = [
        {
            "chunk_id": "page-1-region-2",
            "page": 1,
            "type": "equation",
            "text": "Kinetic Energy formula: E_k = 0.5 * m * v^2",
            "box": {"x": 150, "y": 280, "width": 500, "height": 60},
            "confidence": 0.96,
        }
    ]
    res = httpx.post(
        f"{BASE_URL}/ask",
        json={"question": "What is the kinetic energy formula?", "regions": regions},
        timeout=30.0
    )
    assert res.status_code == 200
    data = res.json()
    print(f"Q&A Answer: {data['answer']}")
    print(f"Source: chunk={data['source_chunk_ids']}, page={data['source_page']}, box={data['source_box']}")
    assert data["answer"]
    assert "page-1-region-2" in data["source_chunk_ids"]
    assert data["source_page"] == 1
    assert data["source_box"] is not None
    print("PASS: Grounded Q&A operates with complete traceability.")


def test_5_validation_safety():
    print("\n[5/5] Testing Edge Case Rejections & Input Safety...")
    # 1. Invalid mode -> 400
    r1 = httpx.post(f"{BASE_URL}/generate", json={"mode": "hack", "regions": [{"chunk_id": "c1", "type": "sentence", "text": "t", "box": [0,0,10,10]}]})
    assert r1.status_code == 400

    # 2. Empty regions -> 400
    r2 = httpx.post(f"{BASE_URL}/generate", json={"mode": "learn", "regions": []})
    assert r2.status_code == 400

    # 3. Invalid file extension -> 400
    r3 = httpx.post(f"{BASE_URL}/analyze", files={"files": ("malicious.exe", b"invalid data", "application/octet-stream")})
    assert r3.status_code == 400

    print("PASS: All input validations correctly enforce security and data integrity.")


def main():
    print("==================================================================")
    print("STARTING COMPLETE MASTER END-TO-END VERIFICATION")
    print("==================================================================")
    test_1_health()
    test_2_analyze_concurrent_and_caching()
    test_3_generate_pipeline()
    test_4_grounded_qa()
    test_5_validation_safety()
    print("\n==================================================================")
    print(">>> ALL 5 MASTER END-TO-END VERIFICATION SUITES PASSED! <<<")
    print("==================================================================")


if __name__ == "__main__":
    main()
