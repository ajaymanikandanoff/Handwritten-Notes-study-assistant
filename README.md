# Handwritten Notes Study Assistant 📝✨

A multimodal AI study assistant for students that analyzes photos of handwritten study notes, generates step-by-step breakdowns and quizzes, provides Click-to-Highlight source verification against original handwriting, and enables voice-interactive Q&A.

---

## 🌟 Key Features

1. **Multi-Page Handwritten Note Ingestion**:
   - Upload multiple notebook pages simultaneously.
   - Preserves page ordering and aggregates concepts across the entire study session.

2. **Multimodal Vision Analysis (`/analyze`)**:
   - Powered by Google Gemini 3.8 Flash Vision (`google-genai` SDK) with EasyOCR / OpenCV layout fallback.
   - Detects and categorizes handwritten regions into:
     - `sentence` (blue)
     - `equation` (purple)
     - `marked-important` (amber/gold)
     - `flowchart` (cyan)
     - `diagram` (emerald)
   - Transcribes handwriting and computes pixel bounding boxes `[left, top, right, bottom]`.

3. **Study Aid Generation (`/generate` - Learn Mode)**:
   - Executive concept summary.
   - High-priority breakdown emphasizing marked-important concepts (`*`, underlines, callouts).
   - Step-by-step breakdown of equations with physical variable meanings.
   - Verbal descriptions of sketches, diagrams, and flowcharts.

4. **Interactive Quiz (`/generate` - Test Mode)**:
   - Multiple Choice Questions (MCQs) and Short-Answer questions.
   - Instant feedback with animated correct/incorrect state and confetti celebrations.
   - Score tracker and question explanations.

5. **Click-to-Highlight Source Verification**:
   - Zero Hallucination Guarantee: Every single quiz question, equation, and concept strictly links to its source `chunk_id`, `page`, and `box`.
   - Clicking **"Verify in Note"** on any question opens a modal displaying the original handwritten note page with an animated glowing highlight over that exact bounding box.

6. **Grounded Voice Assistant (`/ask`)**:
   - Web Speech API (`SpeechRecognition` & `speechSynthesis`).
   - Students can speak questions or type them.
   - Answers are strictly grounded in the uploaded notes and read aloud.
   - Every answer includes clickable source coordinate links.

---

## 🚀 Quick Start

### 1. Backend (FastAPI on Port 8000)
```bash
# Virtual environment / dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend (React + Vite + Tailwind CSS on Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Visit **`http://localhost:5173`** in your browser!

---

## ⚙️ Configuration (`.env`)
```ini
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=
VISION_PROVIDER=gemini
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
UPLOADS_DIR=backend/uploads
```
