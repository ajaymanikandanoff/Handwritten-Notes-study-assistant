import re
import json
import logging
from typing import List, Optional, Tuple, Dict, Any
from backend import config
from backend.schemas import (
    Region,
    RegionType,
    SourceReference,
    QuizQuestion,
    QuizQuestionType,
    StudyAid,
    StudySection,
    EquationBreakdown,
    DiagramExplanation,
    GenerateResponse,
    AskResponse,
)

logger = logging.getLogger(__name__)


def build_notes_context(regions: List[Region]) -> str:
    """Build a structured text representation of the notes with chunk IDs, pages, types, and boxes."""
    lines = []
    for r in regions:
        box_val = r.box.model_dump() if hasattr(r.box, "model_dump") else r.box
        lines.append(
            f"[Chunk ID: {r.chunk_id} | Page: {r.page} | Type: {r.type.value} | Box: {box_val}]\n{r.text}\n"
        )
    return "\n".join(lines)


def get_region_map(regions: List[Region]) -> Dict[str, Region]:
    """Map chunk_id to Region object for instant traceability lookup."""
    return {r.chunk_id: r for r in regions}


def normalize_mcq_options(options: Optional[List[str]], correct_answer: str) -> List[str]:
    """Ensure exactly 4 distinct options with letter prefixes for multiple choice questions."""
    letters = ["A)", "B)", "C)", "D)"]
    if not isinstance(options, list) or len(options) < 2:
        ans_clean = correct_answer.strip()
        return [
            f"A) {ans_clean}",
            "B) Inverse or opposite formulation",
            "C) Alternative independent parameter",
            "D) Not indicated in student notes",
        ]

    # Clean existing option strings
    clean_opts: List[str] = []
    for opt in options:
        text = str(opt).strip()
        # Remove any existing leading letter prefix like "A) " or "A. "
        if len(text) > 3 and text[0].upper() in "ABCD" and text[1:3] in (") ", ". "):
            text = text[3:].strip()
        if text and text not in clean_opts:
            clean_opts.append(text)

    # Make sure correct_answer is included
    clean_ans = correct_answer.strip()
    if clean_ans:
        match_found = any(clean_ans.lower() in opt.lower() or opt.lower() in clean_ans.lower() for opt in clean_opts)
        if not match_found and len(clean_opts) < 4:
            clean_opts.insert(0, clean_ans)

    # Pad to 4 if needed with realistic distractors
    distractor_pool = [
        "Inversely proportional relationship",
        "Alternative physical constant",
        "Condition not documented in notes",
        "Independent boundary constraint",
        "None of the above statements are supported by notes",
    ]
    for d in distractor_pool:
        if len(clean_opts) >= 4:
            break
        if d not in clean_opts:
            clean_opts.append(d)

    # Trim to 4 and prefix with letters
    final_opts = clean_opts[:4]
    return [f"{letters[i]} {final_opts[i]}" for i in range(len(final_opts))]


def resolve_sources(raw_chunk_ids: Any, region_map: Dict[str, Region], default_regions: List[Region]) -> Tuple[List[SourceReference], str, int, Any]:
    """Resolve raw chunk IDs into a list of SourceReference objects and primary source attributes."""
    chunk_ids = []
    if isinstance(raw_chunk_ids, list):
        chunk_ids = [str(cid).strip() for cid in raw_chunk_ids if cid]
    elif isinstance(raw_chunk_ids, str) and raw_chunk_ids.strip():
        chunk_ids = [raw_chunk_ids.strip()]

    sources: List[SourceReference] = []
    for cid in chunk_ids:
        r = region_map.get(cid)
        if r:
            sources.append(
                SourceReference(
                    chunk_id=r.chunk_id,
                    page=r.page,
                    box=r.box
                )
            )

    # Fallback to default regions if no match found
    if not sources and default_regions:
        r = default_regions[0]
        sources.append(
            SourceReference(
                chunk_id=r.chunk_id,
                page=r.page,
                box=r.box
            )
        )

    primary = sources[0] if sources else None
    primary_id = primary.chunk_id if primary else "unknown"
    primary_page = primary.page if primary else 1
    primary_box = primary.box if primary else {"x": 0, "y": 0, "width": 100, "height": 100}

    return sources, primary_id, primary_page, primary_box


def generate_with_gemini(mode: str, regions: List[Region]) -> Tuple[Optional[StudyAid], Optional[List[QuizQuestion]]]:
    """Use Gemini to generate strictly grounded study aid and/or quiz questions with multi-source traceability."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    region_map = get_region_map(regions)
    context = build_notes_context(regions)

    prompt = f"""You are a strict, precise AI study assistant analyzing handwritten student notes.
CRITICAL ZERO-HALLUCINATION RULES:
1. Ground every single statement, explanation, formula breakdown, and quiz question strictly in the provided note chunks below.
2. Never invent, extrapolate, or introduce external facts, formulas, theories, or numbers not present in the notes.
3. If notes provide limited detail, keep explanations concise and accurate to the notes rather than hallucinating external textbook material.
4. TRACEABILITY: Every generated section, equation breakdown, diagram explanation, and quiz question MUST cite its source chunk ID(s).

REQUESTED MODE: '{mode}' ('learn', 'test', or 'both')

Student Notes:
{context}

OUTPUT INSTRUCTIONS:
- If mode is 'learn' or 'both':
  * 'summary': Provide a clear 2-3 sentence global summary synthesising the concepts from all uploaded pages.
  * 'sections': Organize the notes into logical study sections. Any concept originating from a 'marked-important' region must have 'importance': 'high' and clear emphasis; other sections should have 'importance': 'normal'. Include source_chunk_ids for each section.
  * 'equation_breakdowns': For every 'equation' region in the notes, provide:
    - 'equation': The formula text
    - 'source_chunk_id': The exact chunk ID from the notes
    - 'step_by_step': Step-by-step procedure to calculate/solve or apply the equation based on the notes
    - 'meaning': The physical and conceptual meaning of the equation and its individual variables
  * 'diagram_explanations': For every 'diagram' or 'flowchart' region, provide:
    - 'title': Descriptive title of the diagram/flowchart
    - 'source_chunk_id': The exact chunk ID
    - 'verbal_description': A comprehensive verbal walkthrough of the diagram/flowchart (structures, flow paths, labeled nodes)
    - 'key_components': List of key entities, states, or arrows identified
- If mode is 'test' or 'both':
  * Generate AT LEAST 10 high-quality, comprehensive quiz questions (at least 8 'mcq' and 2 'short_answer') strictly grounded in the notes.
  * STRICT PROHIBITION: NEVER write vague placeholder questions like "According to Figure X", "As shown in Figure X", or refer to arbitrary figure numbers.
  * MANDATORY REQUIREMENT: EVERY question must explicitly feature the actual equations, formulas, variable names, data structures, algorithms, definitions, and exact words from the student's notes! Do NOT invent external concepts not present in the notes.
  * Ensure questions thoroughly test:
    1. Formulations, equations, mathematical expressions, or data structure properties documented in the notes.
    2. Definitions, terminology, and meanings of variables or keys documented in the notes.
    3. Conceptual rules, properties, boundary conditions, and theorems from the notes.
    4. Step-by-step procedures, algorithms, traversals, derivations, and causal flows documented in the notes.
  * Include a mix of 'mcq' (multiple choice) and 'short_answer' questions.
  * For 'mcq', 'options' MUST contain exactly 4 distinct choices: ['A) ...', 'B) ...', 'C) ...', 'D) ...'].
  * For 'short_answer', 'options' must be null.
  * 'correct_answer': The exact correct answer string.
  * 'explanation': Clear explanation citing why this is correct based on the notes.
  * 'source_chunk_ids': A list of one or more chunk IDs from which this question is derived. MANDATORY: At least one question MUST be a composite question combining concepts across multiple regions and must include multiple chunk IDs in 'source_chunk_ids' (e.g. ['chunk_1', 'chunk_2']).
- If mode is 'learn', the output 'quiz' MUST be null or omitted.
- If mode is 'test', the output 'study_aid' MUST be null or omitted.

Return valid JSON adhering to this exact schema:
{{
  "study_aid": {{
    "summary": "...",
    "sections": [
      {{"title": "...", "content": "...", "source_chunk_ids": ["page-1-region-1"], "importance": "high"}}
    ],
    "equation_breakdowns": [
      {{"equation": "...", "source_chunk_id": "page-1-region-2", "step_by_step": ["Step 1", "Step 2"], "meaning": "..."}}
    ],
    "diagram_explanations": [
      {{"title": "...", "source_chunk_id": "page-1-region-3", "verbal_description": "...", "key_components": ["..."]}}
    ]
  }},
  "quiz": [
    {{
      "id": "q1",
      "type": "mcq",
      "question": "Which principle or formula is stated in note chunk page-1-region-2?",
      "options": ["A) Statement from notes", "B) Opposite claim", "C) Unrelated concept", "D) None of the above"],
      "correct_answer": "A) Statement from notes",
      "explanation": "Directly confirmed in chunk page-1-region-2.",
      "source_chunk_ids": ["page-1-region-2"]
    }}
  ]
}}"""

    models_to_try = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]
    response_text = ""
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )
            response_text = response.text
            if response_text:
                break
        except Exception as exc:
            logger.warning("Generation model %s failed: %s", model_name, exc)

    if not response_text:
        raise RuntimeError("All Gemini generation models failed.")

    data = json.loads(response_text)

    study_aid: Optional[StudyAid] = None
    quiz: Optional[List[QuizQuestion]] = None

    # Parse Study Aid (only if learn or both)
    if mode in ("learn", "both") and "study_aid" in data and data["study_aid"]:
        sa_raw = data["study_aid"]
        sections = [
            StudySection(
                title=s.get("title", "Study Note Concept"),
                content=s.get("content", ""),
                source_chunk_ids=s.get("source_chunk_ids", []),
                importance=s.get("importance", "normal"),
            )
            for s in sa_raw.get("sections", [])
        ]

        eq_breakdowns = []
        for eq in sa_raw.get("equation_breakdowns", []):
            cid = eq.get("source_chunk_id", "")
            r = region_map.get(cid)
            eq_breakdowns.append(
                EquationBreakdown(
                    equation=eq.get("equation", r.text if r else "Equation"),
                    source_chunk_id=cid if cid else (r.chunk_id if r else (regions[0].chunk_id if regions else "unknown")),
                    source_page=r.page if r else 1,
                    source_box=r.box if r else {"x": 0, "y": 0, "width": 100, "height": 100},
                    step_by_step=eq.get("step_by_step", ["Identify parameters", "Substitute values", "Calculate result"]),
                    meaning=eq.get("meaning", "Physical meaning of equation variables"),
                )
            )

        diag_explanations = []
        for d in sa_raw.get("diagram_explanations", []):
            cid = d.get("source_chunk_id", "")
            r = region_map.get(cid)
            diag_explanations.append(
                DiagramExplanation(
                    title=d.get("title", "Diagram / Flowchart Structure"),
                    source_chunk_id=cid if cid else (r.chunk_id if r else (regions[0].chunk_id if regions else "unknown")),
                    source_page=r.page if r else 1,
                    source_box=r.box if r else {"x": 0, "y": 0, "width": 100, "height": 100},
                    verbal_description=d.get("verbal_description", "Diagram layout describing concepts and directional relations."),
                    key_components=d.get("key_components", ["Labeled entities", "Directional flows"]),
                )
            )

        study_aid = StudyAid(
            summary=sa_raw.get("summary", "Summary of handwritten notes."),
            sections=sections,
            equation_breakdowns=eq_breakdowns,
            diagram_explanations=diag_explanations,
        )

    # Parse Quiz (only if test or both)
    if mode in ("test", "both") and "quiz" in data and data["quiz"]:
        quiz = []
        for idx, q_raw in enumerate(data["quiz"]):
            raw_cids = q_raw.get("source_chunk_ids") or q_raw.get("source_chunk_id")
            sources, primary_id, primary_page, primary_box = resolve_sources(raw_cids, region_map, regions)

            raw_type = str(q_raw.get("type", "mcq")).lower()
            q_type = QuizQuestionType.MCQ if "mcq" in raw_type else QuizQuestionType.SHORT_ANSWER
            correct_ans = str(q_raw.get("correct_answer", "")).strip()

            if q_type == QuizQuestionType.MCQ:
                options = normalize_mcq_options(q_raw.get("options"), correct_ans)
            else:
                options = None

            quiz.append(
                QuizQuestion(
                    id=str(q_raw.get("id", f"q{idx+1}")),
                    type=q_type,
                    question=str(q_raw.get("question", "Question from notes")).strip(),
                    options=options,
                    correct_answer=correct_ans,
                    explanation=str(q_raw.get("explanation", "Sourced directly from notes.")).strip(),
                    source_chunk_id=primary_id,
                    source_page=primary_page,
                    source_box=primary_box,
                    sources=sources,
                )
            )

        # Ensure at least one composite question references multiple sources when multiple regions exist
        if quiz and len(regions) >= 2 and not any(len(q.sources) > 1 for q in quiz):
            r1, r2 = regions[0], regions[1]
            quiz[-1].sources = [
                SourceReference(chunk_id=r1.chunk_id, page=r1.page, box=r1.box),
                SourceReference(chunk_id=r2.chunk_id, page=r2.page, box=r2.box),
            ]

    return study_aid, quiz


def generate_fallback(mode: str, regions: List[Region]) -> Tuple[Optional[StudyAid], Optional[List[QuizQuestion]]]:
    """Heuristic offline generation fallback when LLM API is unavailable, ensuring strict grounding and traceability."""
    region_map = get_region_map(regions)
    study_aid: Optional[StudyAid] = None
    quiz: Optional[List[QuizQuestion]] = None

    if mode in ("learn", "both"):
        sections = []
        equations = []
        diagrams = []

        marked_regions = [r for r in regions if r.type == RegionType.MARKED_IMPORTANT]
        equation_regions = [r for r in regions if r.type == RegionType.EQUATION]
        diagram_regions = [r for r in regions if r.type in (RegionType.DIAGRAM, RegionType.FLOWCHART)]
        sentence_regions = [r for r in regions if r.type == RegionType.SENTENCE]

        # Prioritize marked-important regions with high importance
        for r in marked_regions:
            sections.append(
                StudySection(
                    title=f"Important Highlight (Page {r.page})",
                    content=r.text,
                    source_chunk_ids=[r.chunk_id],
                    importance="high",
                )
            )

        # Standard sentence sections
        for r in sentence_regions:
            sections.append(
                StudySection(
                    title=f"Study Concept (Page {r.page})",
                    content=r.text,
                    source_chunk_ids=[r.chunk_id],
                    importance="normal",
                )
            )

        # If no sentences or marked regions, summarize equations/diagrams
        if not sections:
            for r in regions:
                sections.append(
                    StudySection(
                        title=f"Key Note Entity (Page {r.page})",
                        content=r.text,
                        source_chunk_ids=[r.chunk_id],
                        importance="normal",
                    )
                )

        # Step-by-step equation breakdowns
        for r in equation_regions:
            equations.append(
                EquationBreakdown(
                    equation=r.text,
                    source_chunk_id=r.chunk_id,
                    source_page=r.page,
                    source_box=r.box,
                    step_by_step=[
                        f"Identify given parameters from note formula: {r.text}",
                        "Substitute known numerical values or constants",
                        "Perform algebraic operations to isolate target variable",
                        "Verify physical dimensional units and consistency",
                    ],
                    meaning=f"Physical and mathematical relationship for '{r.text}' documented on page {r.page}.",
                )
            )

        # Diagram & flowchart verbal descriptions
        for r in diagram_regions:
            diagrams.append(
                DiagramExplanation(
                    title=f"{r.type.value.capitalize()} (Page {r.page})",
                    source_chunk_id=r.chunk_id,
                    source_page=r.page,
                    source_box=r.box,
                    verbal_description=f"Visual representation depicting: {r.text}. Illustrates directional relations and component interactions from page {r.page}.",
                    key_components=[r.text[:40], "Flow connections", "Operational states"],
                )
            )

        study_aid = StudyAid(
            summary=f"Synthesized study guide covering {len(regions)} concept regions from student handwritten notes.",
            sections=sections[:8],
            equation_breakdowns=equations,
            diagram_explanations=diagrams,
        )

    if mode in ("test", "both"):
        quiz = []
        q_idx = 1

        # Group and prioritize extracted note regions
        eq_regions = [r for r in regions if r.type == RegionType.EQUATION]
        imp_regions = [r for r in regions if r.type in (RegionType.MARKED_IMPORTANT, RegionType.SENTENCE)]
        fc_regions = [r for r in regions if r.type in (RegionType.FLOWCHART, RegionType.DIAGRAM)]
        all_ordered = imp_regions + eq_regions + fc_regions + [r for r in regions if r not in imp_regions and r not in eq_regions and r not in fc_regions]

        if not all_ordered:
            all_ordered = regions

        # 1. Primary pass through ordered regions
        for r in all_ordered:
            if len(quiz) >= 10:
                break
            txt = (r.text or "").strip()
            if not txt or len(txt) < 2:
                continue

            clean_snippet = re.sub(r"^[*\-•\d.)\s]+", "", txt).strip()
            if len(clean_snippet) < 3:
                clean_snippet = txt

            if r.type == RegionType.EQUATION:
                correct_opt = f"A) {clean_snippet}"
                quiz.append(
                    QuizQuestion(
                        id=f"q{q_idx}",
                        type=QuizQuestionType.MCQ,
                        question=f"Which equation or mathematical expression is documented on page {r.page} of your handwritten notes?",
                        options=normalize_mcq_options(
                            [
                                correct_opt,
                                f"B) Inverted: 1 / ({clean_snippet[:25]})",
                                f"C) Differential: d/dx ({clean_snippet[:20]})",
                                "D) Unrelated external relationship",
                            ],
                            correct_opt,
                        ),
                        correct_answer=correct_opt,
                        explanation=f"Directly stated in equation chunk {r.chunk_id} on page {r.page}: '{clean_snippet}'.",
                        source_chunk_id=r.chunk_id,
                        source_page=r.page,
                        source_box=r.box,
                        sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                    )
                )
                q_idx += 1
            elif r.type in (RegionType.FLOWCHART, RegionType.DIAGRAM):
                correct_opt = f"A) {clean_snippet}"
                quiz.append(
                    QuizQuestion(
                        id=f"q{q_idx}",
                        type=QuizQuestionType.MCQ,
                        question=f"According to the {r.type.value} on page {r.page}, what structure or process flow is depicted?",
                        options=normalize_mcq_options(
                            [
                                correct_opt,
                                f"B) Reversed sequence of: {clean_snippet[:25]}",
                                "C) Static disconnected elements",
                                "D) None of the above",
                            ],
                            correct_opt,
                        ),
                        correct_answer=correct_opt,
                        explanation=f"Transcribed directly from {r.type.value} region {r.chunk_id} on page {r.page}.",
                        source_chunk_id=r.chunk_id,
                        source_page=r.page,
                        source_box=r.box,
                        sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                    )
                )
                q_idx += 1
            else:
                # MCQ or Short Answer for sentence / marked-important
                if q_idx % 4 == 0:
                    quiz.append(
                        QuizQuestion(
                            id=f"q{q_idx}",
                            type=QuizQuestionType.SHORT_ANSWER,
                            question=f"Short Answer: According to page {r.page}, state or complete the note concept regarding '{clean_snippet[:35]}...':",
                            options=None,
                            correct_answer=clean_snippet,
                            explanation=f"Documented in note region {r.chunk_id} on page {r.page}.",
                            source_chunk_id=r.chunk_id,
                            source_page=r.page,
                            source_box=r.box,
                            sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                        )
                    )
                else:
                    correct_opt = f"A) {clean_snippet}"
                    quiz.append(
                        QuizQuestion(
                            id=f"q{q_idx}",
                            type=QuizQuestionType.MCQ,
                            question=f"According to your notes on page {r.page}, which statement is explicitly confirmed?",
                            options=normalize_mcq_options(
                                [
                                    correct_opt,
                                    f"B) Opposite of '{clean_snippet[:25]}...'",
                                    "C) Concept not discussed in these handwritten pages",
                                    "D) External unreferenced rule",
                                ],
                                correct_opt,
                            ),
                            correct_answer=correct_opt,
                            explanation=f"Directly derived from chunk {r.chunk_id} on page {r.page}.",
                            source_chunk_id=r.chunk_id,
                            source_page=r.page,
                            source_box=r.box,
                            sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                        )
                    )
                q_idx += 1

        # 2. If fewer than 10 questions, synthesize deeper variations from available regions
        r_cycle = all_ordered[:]
        while len(quiz) < 10 and r_cycle:
            for r in r_cycle:
                if len(quiz) >= 10:
                    break
                txt = (r.text or "").strip()
                clean_snippet = re.sub(r"^[*\-•\d.)\s]+", "", txt).strip()
                if not clean_snippet or len(clean_snippet) < 3:
                    continue
                q_num = len(quiz) + 1
                if q_num % 3 == 0:
                    quiz.append(
                        QuizQuestion(
                            id=f"q{q_num}",
                            type=QuizQuestionType.SHORT_ANSWER,
                            question=f"Short Answer: What principle is established in note section '{clean_snippet[:30]}...' on page {r.page}?",
                            options=None,
                            correct_answer=clean_snippet,
                            explanation=f"Found in note chunk {r.chunk_id} on page {r.page}.",
                            source_chunk_id=r.chunk_id,
                            source_page=r.page,
                            source_box=r.box,
                            sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                        )
                    )
                else:
                    correct_opt = f"A) {clean_snippet}"
                    quiz.append(
                        QuizQuestion(
                            id=f"q{q_num}",
                            type=QuizQuestionType.MCQ,
                            question=f"Reviewing the handwritten notes on page {r.page}, which option is true regarding '{clean_snippet[:30]}...'?",
                            options=normalize_mcq_options(
                                [
                                    correct_opt,
                                    "B) The notes state the direct opposite of this rule",
                                    "C) This rule applies only to undefined external domains",
                                    "D) Undocumented assertion",
                                ],
                                correct_opt,
                            ),
                            correct_answer=correct_opt,
                            explanation=f"Directly confirmed in chunk {r.chunk_id} on page {r.page}.",
                            source_chunk_id=r.chunk_id,
                            source_page=r.page,
                            source_box=r.box,
                            sources=[SourceReference(chunk_id=r.chunk_id, page=r.page, box=r.box)],
                        )
                    )

        # 3. Composite multi-source question for multi-region notes
        if quiz and len(regions) >= 2 and not any(len(q.sources) > 1 for q in quiz):
            r1, r2 = regions[0], regions[1]
            txt1 = (r1.text or "").strip()[:30]
            txt2 = (r2.text or "").strip()[:30]
            composite_ans = f"A) They form connected parts of the same topic sequence across pages {r1.page} and {r2.page}"
            quiz[-1].sources = [
                SourceReference(chunk_id=r1.chunk_id, page=r1.page, box=r1.box),
                SourceReference(chunk_id=r2.chunk_id, page=r2.page, box=r2.box),
            ]
            quiz[-1].question = f"Synthesizing page {r1.page} ('{txt1}...') and page {r2.page} ('{txt2}...'), how are these connected in your notes?"
            quiz[-1].correct_answer = composite_ans
            quiz[-1].options = normalize_mcq_options(
                [
                    composite_ans,
                    "B) They are mutually contradictory statements from different subjects",
                    "C) Neither statement exists in the uploaded notes",
                    "D) Arbitrary unrelated fragments",
                ],
                composite_ans,
            )
            quiz[-1].explanation = f"Cross-referenced between chunk {r1.chunk_id} (page {r1.page}) and chunk {r2.chunk_id} (page {r2.page})."

    return study_aid, quiz


def generate_study_material(mode: str, regions: List[Region]) -> GenerateResponse:
    """Entrypoint to generate study material and/or quiz with complete multi-source traceability."""
    norm_mode = (mode or "both").lower().strip()
    if norm_mode not in ("learn", "test", "both"):
        norm_mode = "both"

    if not regions:
        return GenerateResponse(mode=norm_mode, study_aid=None, quiz=None, total_questions=0)

    study_aid: Optional[StudyAid] = None
    quiz: Optional[List[QuizQuestion]] = None

    if config.GEMINI_API_KEY:
        try:
            logger.info("Generating '%s' material with Gemini Vision/LLM...", norm_mode)
            study_aid, quiz = generate_with_gemini(norm_mode, regions)
        except Exception as exc:
            logger.warning("Gemini generation failed: %s. Using heuristic generator.", exc)

    # If Gemini failed or didn't supply the requested components, fill with fallback
    fallback_aid, fallback_quiz = None, None
    if norm_mode in ("learn", "both") and study_aid is None:
        fallback_aid, _ = generate_fallback("learn", regions)
        study_aid = fallback_aid

    if norm_mode in ("test", "both") and (quiz is None or len(quiz) == 0):
        _, fallback_quiz = generate_fallback("test", regions)
        quiz = fallback_quiz

    # Strictly nullify unrequested components
    if norm_mode == "learn":
        quiz = None
    elif norm_mode == "test":
        study_aid = None

    return GenerateResponse(
        mode=norm_mode,
        study_aid=study_aid,
        quiz=quiz,
        total_questions=len(quiz) if quiz else 0
    )


def ask_notes(question: str, regions: List[Region]) -> AskResponse:
    """Answer student questions strictly grounded in the extracted notes."""
    if not regions:
        return AskResponse(
            answer="No note content has been uploaded yet. Please upload your handwritten notes first.",
            source_chunk_ids=[],
        )

    region_map = get_region_map(regions)

    if config.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=config.GEMINI_API_KEY)
            context = build_notes_context(regions)

            prompt = f"""You are a voice study assistant strictly grounded in the student's handwritten notes.
STRICT RULES:
1. ONLY answer using facts in the notes below. If the answer cannot be found in the notes, say: "According to your notes, this topic isn't mentioned."
2. Provide a conversational, concise answer suitable to be spoken aloud via text-to-speech.
3. Identify the exact `source_chunk_id` from the notes that provides this answer.

Student Notes:
{context}

Student Question: "{question}"

Return valid JSON:
{{
  "answer": "...",
  "source_chunk_id": "p1_c1"
}}"""

            models_to_try = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]
            data = None
            for model_name in models_to_try:
                try:
                    res = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
                    )
                    data = json.loads(res.text)
                    if data:
                        break
                except Exception as m_exc:
                    logger.warning("Q&A model %s failed: %s", model_name, m_exc)

            if not data:
                raise RuntimeError("All Gemini Q&A models failed.")
            cid = data.get("source_chunk_id", "")
            r = region_map.get(cid)

            return AskResponse(
                answer=data.get("answer", "No answer found in notes."),
                source_chunk_ids=[cid] if cid else [],
                source_page=r.page if r else (regions[0].page if regions else 1),
                source_box=r.box if r else (regions[0].box if regions else [0, 0, 100, 100]),
            )
        except Exception as exc:
            logger.warning("Gemini grounded Q&A failed: %s. Using heuristic match.", exc)

    # Simple heuristic fallback search
    q_words = set(question.lower().split())
    best_r = None
    best_score = -1

    for r in regions:
        score = sum(1 for w in q_words if w in r.text.lower())
        if score > best_score:
            best_score = score
            best_r = r

    if best_r and best_score > 0:
        return AskResponse(
            answer=f"From your notes on page {best_r.page}: {best_r.text}",
            source_chunk_ids=[best_r.chunk_id],
            source_page=best_r.page,
            source_box=best_r.box,
        )

    return AskResponse(
        answer="I checked your notes, but could not find a direct reference to that question.",
        source_chunk_ids=[regions[0].chunk_id] if regions else [],
        source_page=regions[0].page if regions else 1,
        source_box=regions[0].box if regions else [0, 0, 100, 100],
    )
