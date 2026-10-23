import React, { useState, useEffect, useRef } from "react";
import Screen1Upload from "./components/Screen1Upload";
import Screen2Scanned from "./components/Screen2Scanned";
import Screen3StudyMode from "./components/Screen3StudyMode";
import ScreenStudySet from "./components/ScreenStudySet";
import Screen6SourceModal from "./components/Screen6SourceModal";
import { 
  checkHealth, 
  uploadNote, 
  uploadPdf, 
  analyzeNote, 
  generateContent, 
  askAssistant 
} from "./services/api";

export default function App() {
  // Navigation & Step State
  const [currentScreen, setCurrentScreen] = useState("upload"); // "upload" | "scanned" | "modes" | "study"
  const [studySubTab, setStudySubTab] = useState("summary"); // "summary" | "quiz"
  const [selectedStudyMode, setSelectedStudyMode] = useState("both"); // "learn" | "test" | "both"

  // Document Pages & Regions State
  const [pages, setPages] = useState([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Generated AI Content State
  const [studyAid, setStudyAid] = useState(null);
  const [quiz, setQuiz] = useState([]);

  // Voice Assistant & Speech Synthesis State
  const [voiceState, setVoiceState] = useState({
    isListening: false,
    transcript: "",
    lastAnswer: null,
    isSpeaking: false,
  });

  // Source Verification Modal State (Screen 6)
  const [sourceModal, setSourceModal] = useState({
    isOpen: false,
    data: null,
  });

  // Loading & Processing Flags
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const speechRecognitionRef = useRef(null);

  // Poll backend health on startup
  useEffect(() => {
    checkHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setVoiceState((prev) => ({ ...prev, isListening: true }));
      };

      recognition.onend = () => {
        setVoiceState((prev) => ({ ...prev, isListening: false }));
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setVoiceState((prev) => ({ ...prev, isListening: false }));
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceState((prev) => ({ ...prev, transcript }));
        if (event.results[0].isFinal) {
          handleAskVoice(transcript);
        }
      };

      speechRecognitionRef.current = recognition;
    }
  }, [pages]);

  const allRegions = pages.flatMap((p) => p.regions || []);

  // Start speech recognition
  const handleStartListening = () => {
    if (!speechRecognitionRef.current) {
      alert("Speech recognition is not supported in this browser. You can type questions in the voice bar.");
      return;
    }
    try {
      speechRecognitionRef.current.start();
    } catch (err) {
      console.warn("Speech recognition already running:", err);
    }
  };

  // Stop speech recognition
  const handleStopListening = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
  };

  // Text-to-Speech audio playback
  const handleSpeakAnswer = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setVoiceState((prev) => ({ ...prev, isSpeaking: true }));
    utterance.onend = () => setVoiceState((prev) => ({ ...prev, isSpeaking: false }));
    utterance.onerror = () => setVoiceState((prev) => ({ ...prev, isSpeaking: false }));

    window.speechSynthesis.speak(utterance);
  };

  // Voice Question & Answer
  const handleAskVoice = async (question) => {
    if (!question) return;

    try {
      const res = await askAssistant(question, allRegions);
      const answerObj = {
        text: res.answer,
        source_chunk_ids: res.source_chunk_ids,
        source_page: res.source_page || 1,
        source_box: res.source_box,
      };

      setVoiceState((prev) => ({
        ...prev,
        lastAnswer: answerObj,
        isListening: false,
      }));

      handleSpeakAnswer(res.answer);
    } catch (err) {
      const allRegs = pages.flatMap((p) => p.regions || []);
      const firstRelevant = allRegs.find((r) => r.text && r.text.length > 5);
      const fallback = firstRelevant
        ? `According to page ${firstRelevant.page || 1}: "${firstRelevant.text}"`
        : "I couldn't find a direct answer in your uploaded notes. Please ask about terms visible in your notes.";
      setVoiceState((prev) => ({
        ...prev,
        lastAnswer: { text: fallback, source_page: firstRelevant?.page || 1 },
        isListening: false,
      }));
      handleSpeakAnswer(fallback);
    }
  };

  // Upload Photos or PDF
  const handleUploadFiles = async (files) => {
    setIsAnalyzing(true);
    try {
      let updatedPages = [...pages];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

        if (isPdf) {
          const startPage = updatedPages.length + 1;
          const pdfRes = await uploadPdf(file, startPage);
          const pdfPages = pdfRes.pages.map((p) => ({
            page: p.page,
            filename: p.filename,
            width: p.width || 800,
            height: p.height || 1000,
            regions: p.regions || [],
          }));
          updatedPages = [...updatedPages, ...pdfPages];
          if (pdfRes.study_aid) setStudyAid(pdfRes.study_aid);
          if (pdfRes.quiz) setQuiz(pdfRes.quiz);
        } else {
          const pageNum = updatedPages.length + 1;
          const upRes = await uploadNote(file, pageNum);
          const anRes = await analyzeNote({ filename: upRes.filename, page: pageNum });
          updatedPages.push({
            page: pageNum,
            filename: upRes.filename,
            width: upRes.width || 800,
            height: upRes.height || 1000,
            regions: anRes.regions || [],
          });
        }
      }

      setPages(updatedPages);
      setActivePageIndex(0);
      setIsAnalyzing(false);
      setCurrentScreen("scanned");
    } catch (err) {
      alert(`Upload error: ${err.message}`);
      setIsAnalyzing(false);
    }
  };

  // Load Built-in Demo Notes
  const handleLoadDemo = async () => {
    setIsAnalyzing(true);
    try {
      const anRes = await analyzeNote({ filename: "page_1_sample_note.jpg", page: 1 });
      const demoPage1 = {
        page: 1,
        filename: "page_1_sample_note.jpg",
        width: 800,
        height: 1000,
        regions: anRes.regions || [],
      };
      const demoPage2 = {
        page: 2,
        filename: "page_2_page2.jpg",
        width: 800,
        height: 1000,
        regions: [],
      };
      const demoPage3 = {
        page: 3,
        filename: "page_1_page1.jpg",
        width: 800,
        height: 1000,
        regions: [],
      };

      setPages([demoPage1, demoPage2, demoPage3]);
      setActivePageIndex(0);

      // Pre-generate study set with at least 10 questions
      const genRes = await generateContent("both", anRes.regions || []);
      if (genRes.study_aid) setStudyAid(genRes.study_aid);
      if (genRes.quiz) setQuiz(genRes.quiz);

      setIsAnalyzing(false);
      setCurrentScreen("scanned");
    } catch (err) {
      console.warn("Using offline demo fallback:", err);
      setPages([
        { page: 1, filename: "page_1_sample_note.jpg", regions: [] },
        { page: 2, filename: "page_2_page2.jpg", regions: [] },
        { page: 3, filename: "page_1_page1.jpg", regions: [] },
      ]);
      setIsAnalyzing(false);
      setCurrentScreen("scanned");
    }
  };

  // Scan Pages Trigger (Requires at least 1 uploaded page)
  const handleScan = () => {
    if (pages.length === 0) {
      alert("Please upload at least one handwritten note page (take a photo or upload PDF/images) first.");
      return;
    }
    setCurrentScreen("scanned");
  };

  // Generate Study Materials (Screen 3 -> Screen 4/5)
  const handleGenerateStudy = async () => {
    setIsGenerating(true);
    try {
      const regionsToUse = allRegions.length > 0 ? allRegions : [];
      const res = await generateContent(selectedStudyMode, regionsToUse);
      if (res.study_aid) setStudyAid(res.study_aid);
      if (res.quiz && res.quiz.length > 0) setQuiz(res.quiz);

      setStudySubTab(selectedStudyMode === "test" ? "quiz" : "summary");
      setCurrentScreen("study");
    } catch (err) {
      console.warn("Generation error, switching with fallback data:", err);
      setStudySubTab(selectedStudyMode === "test" ? "quiz" : "summary");
      setCurrentScreen("study");
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Screen 6 Source Verification Modal
  const handleOpenSourceModal = (chunkId, pageNum = 1, questionText = "", box = null, sources = []) => {
    let resolvedBox = box;
    let resolvedType = "note passage";
    const targetPage = pages.find((p) => p.page === (pageNum || 1)) || pages[0];
    if (targetPage?.regions) {
      const reg = targetPage.regions.find((r) => r.chunk_id === chunkId);
      if (reg) {
        if (!resolvedBox) resolvedBox = reg.box;
        resolvedType = reg.type || resolvedType;
      }
    }

    setSourceModal({
      isOpen: true,
      data: {
        chunk_id: chunkId || "page-1-region-1",
        page: pageNum || 1,
        questionTitle: questionText ? `Source for "${questionText.slice(0, 48)}..."` : "Source for Question",
        type: resolvedType,
        box: resolvedBox,
        sources: sources,
      },
    });
  };

  const steps = [
    { id: "upload", label: "1. Upload & Voice" },
    { id: "scanned", label: "2. Scanned Regions" },
    { id: "modes", label: "3. Study Modes" },
    { id: "study", label: "4. Study Set" },
  ];

  return (
    <div className="min-h-screen bg-[#E2E8F0] font-sans antialiased text-[#0F172A] flex flex-col items-center">
      {/* Top Application Navbar - Clean, Elegant, No Toggle Switches */}
      <header className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1]/80 bg-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="8" fill="#4338CA" />
            <path d="M8 8v12M14 8v12M20 8v12M6 12h16M6 17h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-[#0F172A]">Noteloom</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EEF0FF] text-[#4338CA] font-semibold border border-[#C7D2FE]">
              Study Assistant
            </span>
          </div>
        </div>

        {/* Stepper Navigation Indicator */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] shadow-xs text-xs font-semibold overflow-x-auto">
          {steps.map((st, sIdx) => {
            const isActive = currentScreen === st.id;
            return (
              <React.Fragment key={st.id}>
                {sIdx > 0 && <span className="text-[#94A3B8]">→</span>}
                <button
                  onClick={() => setCurrentScreen(st.id)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-[#4338CA] text-white shadow-xs"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100"
                  }`}
                >
                  {st.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Connection Status Pill */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#475569]">
          <span className={`w-2.5 h-2.5 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}></span>
          <span>{backendOnline ? "Vision AI Connected" : "Local Engine"}</span>
        </div>
      </header>

      {/* Main Unified Clean Workspace (Naturally Adapts to Both Laptop and Mobile) */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 flex flex-col bg-[#F5F6FB] sm:rounded-[28px] sm:shadow-lg sm:border sm:border-[#CBD5E1]/60 my-2 sm:my-5 transition-all">
        {/* Active Screen Rendering */}
        {currentScreen === "upload" && (
          <Screen1Upload
            pages={pages}
            onUploadFiles={handleUploadFiles}
            onScan={handleScan}
            isAnalyzing={isAnalyzing}
            voiceState={voiceState}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
            onAskVoice={handleAskVoice}
          />
        )}

        {currentScreen === "scanned" && (
          <Screen2Scanned
            pages={pages}
            activePageIndex={activePageIndex}
            setActivePageIndex={setActivePageIndex}
            onBack={() => setCurrentScreen("upload")}
            onContinue={() => setCurrentScreen("modes")}
            onVerifySource={handleOpenSourceModal}
          />
        )}

        {currentScreen === "modes" && (
          <Screen3StudyMode
            pages={pages}
            selectedMode={selectedStudyMode}
            setSelectedMode={setSelectedStudyMode}
            onBack={() => setCurrentScreen("scanned")}
            onGenerate={handleGenerateStudy}
            isGenerating={isGenerating}
          />
        )}

        {currentScreen === "study" && (
          <ScreenStudySet
            pages={pages}
            studyAid={studyAid}
            quiz={quiz}
            activeTab={studySubTab}
            setActiveTab={setStudySubTab}
            onBack={() => setCurrentScreen("modes")}
            onOpenSourceModal={handleOpenSourceModal}
            voiceState={voiceState}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
            onAskVoice={handleAskVoice}
            onSpeakAnswer={handleSpeakAnswer}
            isSpeaking={voiceState.isSpeaking}
          />
        )}
      </main>

      {/* Screen 6: Source Verification Modal Overlay (Centered on Laptop, Bottom Sheet on Mobile) */}
      <Screen6SourceModal
        isOpen={sourceModal.isOpen}
        onClose={() => setSourceModal({ isOpen: false, data: null })}
        sourceData={sourceModal.data}
        pages={pages}
      />
    </div>
  );
}
