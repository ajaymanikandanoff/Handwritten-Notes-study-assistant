"""
Comprehensive Test Suite for Task 2: Study Aid & Quiz Generation (POST /generate)
Verifies:
1. Validation: Rejection of invalid modes (400) and empty regions (400)
2. LEARN Mode: Study sections, step-by-step equations, verbal diagram descriptions, marked-important emphasis, quiz=None
3. TEST Mode: High-quality MCQs (exactly 4 options), short-answer, correct answers, explanations, study_aid=None
4. BOTH Mode: Simultaneous generation of comprehensive study aid and interactive quiz
5. Strict Traceability: chunk_id, page, and bounding box coordinates for all questions and breakdowns
6. Multi-Source Traceability: Composite questions referencing multiple note chunks with complete sources list
7. Offline Fallback: Reliable heuristic generator when external API is unavailable
8. Grounded Q&A (POST /ask) regression check
"""

import httpx
import json
from backend.schemas import Region, RegionType, BoundingBox
from backend.services.generation_service import generate_fallback, resolve_sources, normalize_mcq_options

BASE_URL = "http://127.0.0.1:8000"

# Mock extracted regions representative of realistic multi-page notes
SAMPLE_REGIONS = [
    {
        "chunk_id": "page-1-region-1",
        "page": 1,
        "type": "marked-important",
        "text": "CRITICAL LAW: Total energy in an isolated system remains constant over time. E_total = K + U = Constant.",
        "box": {"x": 100, "y": 150, "width": 800, "height": 80},
        "confidence": 0.98,
    },
    {
        "chunk_id": "page-1-region-2",
        "page": 1,
        "type": "equation",
        "text": "W = F * d * cos(theta)",
        "box": {"x": 120, "y": 300, "width": 600, "height": 60},
        "confidence": 0.97,
    },
    {
        "chunk_id": "page-1-region-3",
        "page": 1,
        "type": "flowchart",
        "text": "Energy Flow: Solar Radiation -> Photovoltaic Cell -> Inverter (DC to AC) -> Electric Grid.",
        "box": {"x": 150, "y": 450, "width": 750, "height": 180},
        "confidence": 0.92,
    },
    {
        "chunk_id": "page-2-region-1",
        "page": 2,
        "type": "sentence",
        "text": "Power is defined as the rate of doing work or transferring energy per unit time: P = W / t, measured in Watts (W).",
        "box": {"x": 100, "y": 200, "width": 780, "height": 90},
        "confidence": 0.95,
    },
    {
        "chunk_id": "page-2-region-2",
        "page": 2,
        "type": "diagram",
        "text": "Thermodynamic heat engine cycle: High Temperature Reservoir (T_H) -> Heat Engine (W_out) -> Low Temperature Reservoir (T_C).",
        "box": {"x": 140, "y": 380, "width": 700, "height": 220},
        "confidence": 0.91,
    },
]


def test_validation():
    print("\n--- TEST 1: Validation Rules (Invalid Mode & Empty Regions) ---")
    
    # Test invalid mode
    res_inv = httpx.post(f"{BASE_URL}/generate", json={"mode": "unsupported_mode", "regions": SAMPLE_REGIONS}, timeout=10.0)
    print(f"Invalid mode status: {res_inv.status_code} | Detail: {res_inv.json().get('detail')}")
    assert res_inv.status_code == 400, f"Expected 400 for invalid mode, got {res_inv.status_code}"

    # Test empty mode
    res_empty_m = httpx.post(f"{BASE_URL}/generate", json={"mode": "", "regions": SAMPLE_REGIONS}, timeout=10.0)
    assert res_empty_m.status_code == 400, f"Expected 400 for empty mode string, got {res_empty_m.status_code}"

    # Test empty regions
    res_empty_r = httpx.post(f"{BASE_URL}/generate", json={"mode": "learn", "regions": []}, timeout=10.0)
    print(f"Empty regions status: {res_empty_r.status_code} | Detail: {res_empty_r.json().get('detail')}")
    assert res_empty_r.status_code == 400, f"Expected 400 for empty regions, got {res_empty_r.status_code}"
    
    print("[PASS] Validation rules rejected invalid inputs with HTTP 400.")


def test_learn_mode():
    print("\n--- TEST 2: LEARN Mode (Comprehensive Study Aid) ---")
    payload = {"mode": "learn", "regions": SAMPLE_REGIONS}
    res = httpx.post(f"{BASE_URL}/generate", json=payload, timeout=60.0)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["mode"] == "learn", f"Expected mode 'learn', got {data['mode']}"
    assert data["study_aid"] is not None, "Expected study_aid to be present in learn mode"
    assert data["quiz"] is None or len(data["quiz"]) == 0, "Expected quiz to be None or empty in learn mode"
    assert data["total_questions"] == 0, "Expected total_questions == 0 in learn mode"

    sa = data["study_aid"]
    print(f"Summary: {sa['summary']}")
    assert len(sa["summary"]) > 10, "Summary is too short or empty"

    # Verify sections and marked-important emphasis
    sections = sa.get("sections", [])
    print(f"Sections extracted: {len(sections)}")
    assert len(sections) > 0, "No study sections generated"
    has_high_importance = any(s.get("importance") == "high" for s in sections)
    print(f"Contains high-importance marked section: {has_high_importance}")
    assert has_high_importance, "Expected marked-important region to produce section with importance='high'"

    for s in sections:
        assert s.get("title"), "Section title missing"
        assert s.get("content"), "Section content missing"
        assert isinstance(s.get("source_chunk_ids"), list), "Section source_chunk_ids must be a list"

    # Verify step-by-step equation breakdown
    eqs = sa.get("equation_breakdowns", [])
    print(f"Equation breakdowns: {len(eqs)}")
    assert len(eqs) > 0, "Expected equation breakdowns for equation regions"
    for eq in eqs:
        print(f" - Formula: {eq['equation']}")
        print(f"   Meaning: {eq['meaning']}")
        print(f"   Steps: {eq['step_by_step']}")
        assert eq.get("equation"), "Equation text missing"
        assert eq.get("source_chunk_id"), "Equation source_chunk_id missing"
        assert isinstance(eq.get("step_by_step"), list) and len(eq["step_by_step"]) >= 2, "Equation step_by_step breakdown missing or insufficient"
        assert eq.get("meaning"), "Equation variable meaning missing"
        assert eq.get("source_box"), "Equation source_box missing for highlight traceability"

    # Verify diagram / flowchart verbal descriptions
    diags = sa.get("diagram_explanations", [])
    print(f"Diagram explanations: {len(diags)}")
    assert len(diags) > 0, "Expected diagram explanations for diagram/flowchart regions"
    for diag in diags:
        print(f" - Title: {diag['title']}")
        print(f"   Verbal description: {diag['verbal_description'][:80]}...")
        print(f"   Components: {diag['key_components']}")
        assert diag.get("title"), "Diagram title missing"
        assert diag.get("source_chunk_id"), "Diagram source_chunk_id missing"
        assert diag.get("verbal_description"), "Diagram verbal_description missing"
        assert isinstance(diag.get("key_components"), list) and len(diag["key_components"]) >= 1, "Diagram key_components missing"
        assert diag.get("source_box"), "Diagram source_box missing"

    print("[PASS] LEARN mode generated rich structured content with equation steps and diagram descriptions.")


def test_test_mode():
    print("\n--- TEST 3: TEST Mode (Grounded Quiz with 4 Options & Traceability) ---")
    payload = {"mode": "test", "regions": SAMPLE_REGIONS}
    res = httpx.post(f"{BASE_URL}/generate", json=payload, timeout=60.0)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["mode"] == "test", f"Expected mode 'test', got {data['mode']}"
    assert data["study_aid"] is None, "Expected study_aid to be None in test mode"
    quiz = data.get("quiz")
    assert isinstance(quiz, list) and len(quiz) > 0, "Expected non-empty quiz in test mode"
    assert data["total_questions"] == len(quiz), "total_questions mismatch"
    print(f"Total quiz questions generated: {len(quiz)}")

    for idx, q in enumerate(quiz):
        print(f"Q{idx+1} [{q['type']}]: {q['question']}")
        assert q.get("id"), "Question ID missing"
        assert q.get("question"), "Question text missing"
        assert q.get("correct_answer"), "Correct answer missing"
        assert q.get("explanation"), "Explanation missing"
        assert q.get("source_chunk_id"), "Primary source_chunk_id missing"
        assert q.get("source_page") in (1, 2), "Invalid source_page"
        assert q.get("source_box"), "source_box missing for highlighting"

        # Check sources list
        sources = q.get("sources", [])
        assert isinstance(sources, list) and len(sources) >= 1, "sources list must contain at least 1 SourceReference"
        for s in sources:
            assert s.get("chunk_id"), "SourceReference chunk_id missing"
            assert s.get("page") in (1, 2), "SourceReference page missing or invalid"
            assert s.get("box"), "SourceReference box missing"

        if q["type"] == "mcq":
            options = q.get("options")
            assert isinstance(options, list), "MCQ options must be a list"
            assert len(options) == 4, f"MCQ must have exactly 4 options, got {len(options)}: {options}"
            print(f"   Options: {options}")
            print(f"   Answer: {q['correct_answer']}")
        elif q["type"] == "short_answer":
            assert q.get("options") is None, "Short answer question should have options=None"
            print(f"   Correct Model Answer: {q['correct_answer']}")

    print("[PASS] TEST mode generated high-quality questions with 4-choice MCQs and complete traceability.")


def test_both_mode():
    print("\n--- TEST 4: BOTH Mode (Dual Study Aid & Quiz) ---")
    payload = {"mode": "both", "regions": SAMPLE_REGIONS}
    res = httpx.post(f"{BASE_URL}/generate", json=payload, timeout=60.0)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["mode"] == "both", f"Expected mode 'both', got {data['mode']}"
    assert data["study_aid"] is not None, "Expected study_aid in both mode"
    assert isinstance(data.get("quiz"), list) and len(data["quiz"]) > 0, "Expected quiz in both mode"
    assert data["total_questions"] == len(data["quiz"]), "total_questions mismatch"
    print(f"Study sections: {len(data['study_aid']['sections'])} | Quiz questions: {len(data['quiz'])}")
    print("[PASS] BOTH mode successfully generated dual output.")


def test_multi_source_traceability():
    print("\n--- TEST 5: Multi-Source & Composite Question Traceability ---")
    # Verify fallback composite generation
    aid, quiz = generate_fallback("test", [Region(**r) for r in SAMPLE_REGIONS])
    assert quiz is not None and len(quiz) >= 1
    
    # Locate composite question
    composite_qs = [q for q in quiz if len(q.sources) > 1]
    print(f"Found {len(composite_qs)} composite questions referencing multiple sources.")
    assert len(composite_qs) >= 1, "Expected at least one composite question referencing multiple source regions"
    
    cq = composite_qs[0]
    print(f"Composite Question: {cq.question}")
    print(f"Primary Source: chunk_id={cq.source_chunk_id}, page={cq.source_page}")
    print(f"Referenced Sources ({len(cq.sources)}): {[s.chunk_id for s in cq.sources]}")
    assert len(cq.sources) == 2, f"Expected 2 sources, got {len(cq.sources)}"
    assert cq.sources[0].chunk_id == "page-1-region-1"
    assert cq.sources[1].chunk_id == "page-1-region-2"
    assert cq.sources[0].box is not None
    assert cq.sources[1].box is not None
    print("[PASS] Multi-source question traceability verified with all bounding boxes preserved.")


def test_mcq_normalization():
    print("\n--- TEST 6: MCQ Options Normalization Unit Test ---")
    # Case 1: Less than 2 options
    opts1 = normalize_mcq_options(["Only one option"], "Correct statement")
    assert len(opts1) == 4
    assert opts1[0].startswith("A)")
    assert opts1[1].startswith("B)")

    # Case 2: 3 options (pad to 4)
    opts2 = normalize_mcq_options(["Choice 1", "Choice 2", "Choice 3"], "Choice 1")
    assert len(opts2) == 4
    assert len(set(opts2)) == 4, "Options must be distinct"

    # Case 3: 5 options (trim to 4)
    opts3 = normalize_mcq_options(["O1", "O2", "O3", "O4", "O5"], "O1")
    assert len(opts3) == 4
    print("[PASS] MCQ option normalization correctly enforces exactly 4 distinct choices.")


def test_offline_fallback():
    print("\n--- TEST 7: Heuristic Offline Fallback Generator ---")
    typed_regions = [Region(**r) for r in SAMPLE_REGIONS]
    
    # Test learn fallback
    aid_learn, quiz_learn = generate_fallback("learn", typed_regions)
    assert aid_learn is not None, "Fallback failed to create study aid in learn mode"
    assert quiz_learn is None, "Fallback must set quiz=None in learn mode"
    assert len(aid_learn.sections) > 0, "No sections in fallback study aid"
    assert len(aid_learn.equation_breakdowns) == 1, "Expected 1 equation breakdown"
    assert len(aid_learn.diagram_explanations) == 2, "Expected 2 diagram explanations"
    print(f"Fallback learn: {len(aid_learn.sections)} sections, {len(aid_learn.equation_breakdowns)} equations, {len(aid_learn.diagram_explanations)} diagrams.")

    # Test test fallback
    aid_test, quiz_test = generate_fallback("test", typed_regions)
    assert aid_test is None, "Fallback must set study_aid=None in test mode"
    assert quiz_test is not None and len(quiz_test) >= 3, "Fallback quiz questions missing"
    for q in quiz_test:
        if q.type == "mcq":
            assert len(q.options) == 4, f"Fallback MCQ options != 4: {q.options}"
        assert q.source_chunk_id, "Fallback source_chunk_id missing"
        assert q.source_box, "Fallback source_box missing"
    print(f"Fallback test: {len(quiz_test)} questions generated with full traceability.")

    print("[PASS] Offline fallback works completely without external LLM dependencies.")


def test_ask_regression():
    print("\n--- TEST 8: Grounded Voice/Text Q&A Regression Check (POST /ask) ---")
    ask_payload = {
        "question": "What is the formula for work done?",
        "regions": SAMPLE_REGIONS
    }
    res = httpx.post(f"{BASE_URL}/ask", json=ask_payload, timeout=30.0)
    assert res.status_code == 200, f"Expected 200 from /ask, got {res.status_code}"
    data = res.json()
    print(f"Answer: {data.get('answer')}")
    print(f"Source chunks: {data.get('source_chunk_ids')}")
    print(f"Source box: {data.get('source_box')}")
    assert data.get("answer"), "No answer returned by /ask"
    assert data.get("source_chunk_ids"), "No source_chunk_ids returned by /ask"
    print("[PASS] Grounded Q&A operates with complete traceability.")


def main():
    print("=================================================================")
    print("RUNNING COMPLETE TASK 2 TEST SUITE (POST /generate & Traceability)")
    print("=================================================================")
    test_validation()
    test_learn_mode()
    test_test_mode()
    test_both_mode()
    test_multi_source_traceability()
    test_mcq_normalization()
    test_offline_fallback()
    test_ask_regression()
    print("\n=================================================================")
    print(">>> ALL 8 TASK 2 TEST SUITES PASSED WITH 100% SUCCESS! <<<")
    print("=================================================================")


if __name__ == "__main__":
    main()
