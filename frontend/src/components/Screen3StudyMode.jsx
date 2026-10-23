import React from "react";

export default function Screen3StudyMode({
  pages = [],
  selectedMode = "both",
  setSelectedMode,
  onBack,
  onGenerate,
  isGenerating,
}) {
  const pageCount = pages.length > 0 ? pages.length : 3;

  const modes = [
    {
      id: "learn",
      title: "Learn",
      badge: "CONCEPT BREAKDOWN",
      badgeColor: "bg-[#DBEAFE] text-[#1E3A8A]",
      desc: "Step-by-step explanations of every equation, flowchart and diagram. Marked-important parts get extra exam focus.",
      highlights: ["Derivation steps for all equations", "High-priority exam callouts", "Verbal flowchart descriptions"],
    },
    {
      id: "test",
      title: "Test",
      badge: "ACTIVE RECALL",
      badgeColor: "bg-[#EDE9FE] text-[#4C1D95]",
      desc: "A quiz only: multiple choice and short answer. Tap any question to verify its exact source in your notes.",
      highlights: ["4-choice MCQs with instant feedback", "Short answer questions", "Click-to-highlight source verification"],
    },
    {
      id: "both",
      title: "Both",
      badge: "RECOMMENDED",
      badgeColor: "bg-[#4338CA] text-white",
      desc: "The full explanation first, then the interactive quiz. The ultimate comprehensive study package.",
      highlights: ["Complete conceptual breakdowns", "Interactive practice quiz", "Full multi-source traceability"],
    },
  ];

  return (
    <div className="w-full flex-1 flex flex-col gap-4 text-[#0F172A]">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#CBD5E1]/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 border border-[#CBD5E1] bg-white rounded-[14px] flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#F8FAFC] active:scale-95 transition-all shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-tight m-0">Choose your study mode</h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5 m-0">
              Everything is built from your {pageCount} scanned note pages.
            </p>
          </div>
        </div>

        {/* Generate Button on top bar for laptops */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="hidden sm:flex h-12 px-8 rounded-[14px] bg-[#4338CA] text-white font-bold text-sm hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>Generate Study Set</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Responsive 3-Column Card Grid (3 columns on Laptop / Tablet, 1 column on Phone) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-2">
        {modes.map((m) => {
          const isSelected = selectedMode === m.id;
          return (
            <div
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`text-left flex flex-col justify-between p-6 rounded-[22px] min-h-[220px] transition-all cursor-pointer shadow-sm relative ${
                isSelected
                  ? "border-2 border-[#4338CA] bg-[#EEF0FF] ring-4 ring-[#4338CA]/10 shadow-md scale-[1.01]"
                  : "border border-[#CBD5E1] bg-white hover:border-[#94A3B8] hover:shadow"
              }`}
            >
              <div>
                {/* Card Top: Badge & Radio Circle */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full box-border shrink-0 transition-all ${
                      isSelected
                        ? "bg-[#4338CA] border-0 ring-4 ring-[#C7D2FE]"
                        : "bg-white border-2 border-[#94A3B8]"
                    }`}
                  />
                </div>

                {/* Card Title & Desc */}
                <h3 className="text-xl font-bold text-[#0F172A] m-0 mb-2">{m.title}</h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed m-0 mb-4">
                  {m.desc}
                </p>
              </div>

              {/* Highlights List */}
              <div className="pt-3 border-t border-[#CBD5E1]/60 flex flex-col gap-1.5">
                {m.highlights.map((h, hIdx) => (
                  <div key={hIdx} className="text-xs text-[#334155] flex items-center gap-1.5">
                    <span className="text-[#4338CA] font-bold">✓</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-[#475569]">
          Selected: <b className="text-[#4338CA] uppercase">{selectedMode} Mode</b> • Zero hallucination guaranteed
        </div>

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full sm:w-auto sm:min-w-[280px] h-14 border-0 rounded-[16px] bg-[#4338CA] text-white text-base font-bold hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Synthesizing with Vision AI...</span>
            </>
          ) : (
            <span>Generate Study Materials</span>
          )}
        </button>
      </div>
    </div>
  );
}
