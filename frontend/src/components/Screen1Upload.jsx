import React, { useRef, useState } from "react";
import { getImageUrl } from "../services/api";

export default function Screen1Upload({
  pages = [],
  onUploadFiles,
  onScan,
  isAnalyzing,
  voiceState,
  onStartListening,
  onStopListening,
  onAskVoice,
}) {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [localVoicePrompt, setLocalVoicePrompt] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const handleCameraChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleVoiceSubmit = (e) => {
    e.preventDefault();
    if (localVoicePrompt.trim()) {
      onAskVoice(localVoicePrompt.trim());
      setLocalVoicePrompt("");
    }
  };

  const pageCount = pages.length;

  return (
    <div className="w-full flex-1 flex flex-col gap-6 text-[#0F172A]">
      {/* Top Header / Branding & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#CBD5E1]/60">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="8" fill="#4338CA" />
              <path d="M8 8v12M14 8v12M20 8v12M6 12h16M6 17h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-[#0F172A]">Noteloom</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EEF0FF] text-[#4338CA] font-semibold border border-[#C7D2FE]">
              AI Study Assistant
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-[#0F172A] m-0">
            Start with a photo or your voice
          </h1>
          <p className="text-sm sm:text-base text-[#475569] mt-0.5 m-0">
            Answers, step-by-step breakdowns, and quizzes come only from your own handwritten notes.
          </p>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Options Grid: Responsive 2 Columns on Laptop / Tablet, 1 Column on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        {/* ================= LEFT CARD: OPTION 1 CAMERA & UPLOAD ================= */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white border rounded-[20px] p-5 flex flex-col justify-between gap-5 transition-all shadow-sm ${
            isDragOver ? "border-[#4338CA] bg-[#F5F7FF] ring-2 ring-[#4338CA]/20" : "border-[#CBD5E1]"
          }`}
        >
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA] block">
                  Option 1 • Camera & File Upload
                </span>
                <span className="text-base sm:text-lg font-bold text-[#0F172A]">
                  Take a photo or upload pages
                </span>
              </div>
            </div>

            {/* Two Action Buttons: Camera & Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAnalyzing}
                className="h-12 rounded-xl bg-[#4338CA] text-white font-semibold text-sm hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Take Photo</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="h-12 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold text-sm hover:bg-[#F8FAFC] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload Photos / PDF</span>
              </button>
            </div>

            {/* Drag & Drop Hint */}
            <div className="text-center py-2 border-2 border-dashed border-[#CBD5E1] rounded-xl text-xs text-[#64748B] bg-[#F8FAFC]">
              Or drag & drop notebook images or PDF notes directly here
            </div>

            {/* Document Thumbnail Previews */}
            <div className="flex items-center gap-3 overflow-x-auto py-2">
              {pages.length > 0 ? (
                pages.map((p, idx) => (
                  <div
                    key={p.page || idx}
                    className="relative w-[76px] h-[98px] bg-white border-2 border-[#4338CA] rounded-[10px] overflow-hidden shadow-xs shrink-0 flex items-center justify-center"
                  >
                    {p.filename ? (
                      <img
                        src={getImageUrl(p.filename)}
                        alt={`Page ${p.page || idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-2 flex flex-col gap-1.5 h-full justify-center">
                        <i className="h-1 bg-[#CBD5E1] rounded-full w-full"></i>
                        <i className="h-1 bg-[#CBD5E1] rounded-full w-3/4"></i>
                        <i className="h-1 bg-[#CBD5E1] rounded-full w-4/5"></i>
                      </div>
                    )}
                    <b className="absolute left-1.5 bottom-1.5 bg-[#4338CA] text-white text-[11px] rounded-lg px-2 py-0.5 font-bold shadow-xs">
                      {p.page || idx + 1}
                    </b>
                  </div>
                ))
              ) : (
                /* Clean Empty State */
                <div className="w-full flex items-center gap-3 py-3 px-2 text-[#64748B] text-sm">
                  <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-dashed border-[#CBD5E1] flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0F172A]">No handwritten notes added yet</span>
                    <span className="text-xs text-[#64748B]">Take a photo with your camera or upload images/PDFs above to begin</span>
                  </div>
                </div>
              )}

              {pages.length > 0 && (
                <div className="flex flex-col justify-end pb-1 pl-1">
                  <span className="text-[13px] text-[#475569] leading-snug font-medium">
                    {pages.length} {pages.length === 1 ? "page" : "pages"}, kept in upload order
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT CARD: OPTION 2 VOICE ================= */}
        <div className="bg-white border border-[#CBD5E1] rounded-[20px] p-5 flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                </span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA] block">
                    Option 2 • Voice Search
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#0F172A]">
                    Ask your notes with voice
                  </span>
                </div>
              </div>

              {/* Mic Active Recording Button */}
              <button
                onClick={voiceState.isListening ? onStopListening : onStartListening}
                className={`w-12 h-12 rounded-full border-0 flex items-center justify-center cursor-pointer transition-all shadow-md active:scale-95 ${
                  voiceState.isListening
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-[#4338CA] text-white hover:bg-[#3730A3]"
                }`}
                title={voiceState.isListening ? "Listening... click to stop" : "Click to speak your question"}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </button>
            </div>

            {/* Quick Prompt Pills */}
            <div className="text-xs font-semibold text-[#64748B]">Or click a quick prompt:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "explain the main theorem",
                "what equations are written?",
                "summarize key points",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => onAskVoice(q)}
                  className="px-3 py-1.5 rounded-full border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-medium text-[#334155] hover:bg-[#EEF0FF] hover:border-[#C7D2FE] hover:text-[#4338CA] transition-colors cursor-pointer"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Listening / Voice Output Bubble & Text Input */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#CBD5E1]/60">
            <div className="bg-[#EEF0FF] border border-[#C7D2FE] rounded-[16px_16px_16px_4px] px-3.5 py-2.5 text-sm text-[#312E81] flex items-center gap-2">
              {voiceState.isListening ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="font-semibold">Listening... "{voiceState.transcript || "ask a question about your notes..."}"</span>
                </>
              ) : voiceState.lastAnswer ? (
                <span>"{voiceState.lastAnswer.text}"</span>
              ) : (
                <span>Listening... "ask anything from your notes..."</span>
              )}
            </div>

            {/* Voice / Text input form */}
            <form onSubmit={handleVoiceSubmit} className="flex gap-2">
              <input
                type="text"
                value={localVoicePrompt}
                onChange={(e) => setLocalVoicePrompt(e.target.value)}
                placeholder="Or type a question about your notes..."
                className="flex-1 h-11 border border-[#CBD5E1] rounded-xl px-3.5 text-sm bg-white text-[#0F172A] focus:outline-none focus:border-[#4338CA]"
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-xl bg-[#4338CA] text-white font-semibold text-xs hover:bg-[#3730A3] transition-colors cursor-pointer"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Prominent Bottom Action Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-[#475569]">
          {pages.length > 0 ? (
            <span>Ready to scan <b className="text-[#0F172A]">{pages.length} note {pages.length === 1 ? "page" : "pages"}</b> with Gemini Vision AI</span>
          ) : (
            <span>Upload your handwritten notebook photos or PDF to scan</span>
          )}
        </div>

        <button
          onClick={onScan}
          disabled={isAnalyzing || pages.length === 0}
          className="w-full sm:w-auto sm:min-w-[280px] h-14 border-0 rounded-[16px] bg-[#4338CA] text-white text-base font-bold hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
        >
          {isAnalyzing ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Scanning handwritten notes...</span>
            </>
          ) : pages.length > 0 ? (
            <span>Scan {pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          ) : (
            <span>Upload notes to scan</span>
          )}
        </button>
      </div>
    </div>
  );
}
