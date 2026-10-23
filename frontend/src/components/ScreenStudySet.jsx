import React, { useState, useMemo } from "react";
import confetti from "canvas-confetti";

function Badge({ children, color = "indigo" }) {
  const map = {
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    teal: "bg-teal-100 text-teal-700 border-teal-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ${map[color]}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function ConceptCard({ sec, idx, onViewSource }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              {idx + 1}
            </span>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug truncate">{sec.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge color="slate">Pg {sec.source_page || 1}</Badge>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
          </div>
        </div>
        {expanded && (
          <>
            <p className="text-sm leading-relaxed text-slate-600 mb-3">{sec.content}</p>
            <button
              onClick={() => onViewSource(sec.source_chunk_ids?.[0] || "page-1-region-1", sec.source_page || 1, sec.title, sec.source_box)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              View source in notes
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

function EquationCard({ eq, onViewSource }) {
  return (
    <Card>
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-white/90 uppercase tracking-widest">Equation</span>
        <Badge color="indigo">Pg {eq.source_page || 1}</Badge>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-base sm:text-lg font-bold text-indigo-700 text-center">
          {eq.equation}
        </div>
        {eq.meaning && (
          <div className="flex gap-2 text-sm text-slate-600">
            <span className="text-purple-600 font-bold shrink-0">Meaning:</span>
            <span className="leading-relaxed">{eq.meaning}</span>
          </div>
        )}
        {eq.step_by_step && eq.step_by_step.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-col gap-2">
            {eq.step_by_step.map((step, sIdx) => (
              <div key={sIdx} className="flex gap-2 text-xs sm:text-sm text-slate-600">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold mt-0.5">{sIdx + 1}</span>
                <span className="leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => onViewSource(eq.source_chunk_id, eq.source_page || 1, `Equation: ${eq.equation}`, eq.source_box)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
          View in notes
        </button>
      </div>
    </Card>
  );
}

function ImportantCard({ imp, onViewSource }) {
  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 sm:p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-base">★</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Key Highlight</span>
        </div>
        <Badge color="amber">Pg {imp.page}</Badge>
      </div>
      <p className="text-sm sm:text-base font-semibold text-amber-900 leading-relaxed">{imp.text}</p>
      <button
        onClick={() => onViewSource(imp.chunk_id, imp.page, imp.title, imp.box)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
        Verify in notes
      </button>
    </div>
  );
}

function FlowchartCard({ fc, onViewSource }) {
  return (
    <Card>
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-white/90 uppercase tracking-widest">Diagram / Flowchart</span>
        <Badge color="teal">Pg {fc.source_page || 1}</Badge>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">{fc.verbal_description || fc.title}</p>
        <button
          onClick={() => onViewSource(fc.source_chunk_id, fc.source_page || 1, fc.title, fc.source_box)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
          Inspect diagram
        </button>
      </div>
    </Card>
  );
}

function MCQOption({ letter, text, isAnswered, isCorrect, isThisSelected, onClick }) {
  let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 flex items-center gap-3 cursor-pointer";
  if (!isAnswered) {
    cls += " border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-800 text-slate-700 active:scale-[0.98]";
  } else if (isCorrect) {
    cls += " border-emerald-400 bg-emerald-50 text-emerald-800 font-bold shadow-sm";
  } else if (isThisSelected) {
    cls += " border-rose-400 bg-rose-50 text-rose-800 font-bold";
  } else {
    cls += " border-slate-100 bg-slate-50 text-slate-400 opacity-60";
  }
  return (
    <button disabled={isAnswered} onClick={onClick} className={cls}>
      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors ${isAnswered && isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : isAnswered && isThisSelected ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-slate-200 text-slate-500"}`}>
        {isAnswered && isCorrect ? "✓" : isAnswered && isThisSelected ? "✗" : letter}
      </span>
      <span className="flex-1 leading-snug">{text}</span>
    </button>
  );
}

function QuizCard({ q, idx, selectedAnswers, shortAnswers, setShortAnswers, onSelectOption, onShortSubmit, onViewSource }) {
  const isAnswered = Boolean(selectedAnswers[q.id]);
  const selectedOpt = selectedAnswers[q.id];
  const isCorrect = isAnswered && selectedOpt === q.correct_answer;

  return (
    <Card>
      <div className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b border-slate-100 ${isAnswered ? (isCorrect ? "bg-emerald-50" : "bg-rose-50") : "bg-slate-50"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white ${isAnswered ? (isCorrect ? "bg-emerald-500" : "bg-rose-500") : "bg-indigo-600"}`}>
            {isAnswered ? (isCorrect ? "✓" : "✗") : idx + 1}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Q{idx + 1}&nbsp;·&nbsp;{q.type === "mcq" ? "Multiple Choice" : "Short Answer"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAnswered && <Badge color={isCorrect ? "teal" : "amber"}>{isCorrect ? "✓ Correct" : "Review"}</Badge>}
          <button
            onClick={() => onViewSource(q.source_chunk_id, q.source_page || 1, q.question, q.source_box, q.sources)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer bg-white border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            Pg {q.source_page || 1}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
        <p className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed">{q.question}</p>

        {q.type === "mcq" && q.options && (
          <div className="flex flex-col gap-2">
            {q.options.map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const isOptCorrect = opt === q.correct_answer;
              return (
                <MCQOption key={oIdx} letter={letter} text={opt} isAnswered={isAnswered} isCorrect={isOptCorrect} isThisSelected={selectedOpt === opt} onClick={() => onSelectOption(q.id, opt, isOptCorrect)} />
              );
            })}
          </div>
        )}

        {q.type === "short_answer" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`sa-${q.id}`} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Answer</label>
            <textarea
              id={`sa-${q.id}`}
              disabled={isAnswered}
              rows={3}
              value={shortAnswers[q.id] || ""}
              onChange={(e) => setShortAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
              placeholder="Write your answer here…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-60"
            />
            {!isAnswered && (
              <button
                onClick={() => onShortSubmit(q.id)}
                className="self-end h-10 px-6 rounded-xl bg-indigo-600 text-white text-sm font-bold cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                Check Answer
              </button>
            )}
            {isAnswered && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex flex-col gap-1">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Model Answer</span>
                <p className="text-sm text-emerald-800 leading-relaxed">{q.correct_answer}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ScreenStudySet({
  pages = [],
  studyAid,
  quiz = [],
  activeTab = "summary",
  setActiveTab,
  onBack,
  onOpenSourceModal,
  voiceState,
  onStartListening,
  onStopListening,
  onAskVoice,
  onSpeakAnswer,
  isSpeaking,
}) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [shortAnswers, setShortAnswers] = useState({});
  const [typedQuestion, setTypedQuestion] = useState("");

  const handleSelectOption = (qId, option, isCorrect) => {
    if (selectedAnswers[qId]) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
    if (isCorrect) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 }, colors: ["#6366f1", "#8b5cf6", "#06b6d4"] });
    }
  };

  const handleShortAnswerSubmit = (qId) => {
    const ans = (shortAnswers[qId] || "").trim();
    if (!ans) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: ans }));
  };

  const handleVoiceBarSubmit = (e) => {
    e.preventDefault();
    const q = typedQuestion.trim();
    if (q) { onAskVoice(q); setTypedQuestion(""); }
  };

  const allRegions = useMemo(() => pages.flatMap((p) => p.regions || []), [pages]);

  const displaySections = useMemo(() => {
    if (studyAid?.sections?.length > 0) return studyAid.sections;
    const sentenceRegs = allRegions.filter((r) => r.type === "sentence" || r.type === "concept" || !r.type);
    return sentenceRegs.slice(0, 8).map((r, idx) => ({
      title: `Concept ${idx + 1} (Page ${r.page || 1})`,
      content: r.text,
      importance: "normal",
      source_page: r.page || 1,
      source_chunk_ids: [r.chunk_id],
      source_box: r.box,
    }));
  }, [studyAid, allRegions]);

  const displayEquations = useMemo(() => {
    if (studyAid?.equation_breakdowns?.length > 0) return studyAid.equation_breakdowns;
    const eqRegs = allRegions.filter((r) => r.type === "equation");
    return eqRegs.map((r) => ({
      equation: r.text,
      source_page: r.page || 1,
      source_chunk_id: r.chunk_id,
      source_box: r.box,
      meaning: `Formula from page ${r.page || 1}: ${r.text}`,
      step_by_step: [`Identified formula: ${r.text}`, `Referenced on page ${r.page || 1}`, `Apply rules from your notes`],
    }));
  }, [studyAid, allRegions]);

  const displayImportant = useMemo(() => {
    const impFromPages = allRegions
      .filter((r) => r.type === "marked-important" || r.type === "important" || r.type === "marked_important")
      .map((r) => ({ page: r.page || 1, title: "MARKED IMPORTANT", text: r.text, chunk_id: r.chunk_id, box: r.box }));
    if (impFromPages.length > 0) return impFromPages;
    const impFromSections = (studyAid?.sections || [])
      .filter((s) => s.importance === "high")
      .map((s) => ({ page: s.source_page || 1, title: s.title || "KEY HIGHLIGHT", text: s.content, chunk_id: s.source_chunk_ids?.[0] || "page-1-region-1", box: s.source_box }));
    if (impFromSections.length > 0) return impFromSections;
    return allRegions.filter((r) => r.type === "sentence" || r.type === "concept").slice(0, 1)
      .map((r) => ({ page: r.page || 1, title: "KEY NOTE PRINCIPLE", text: r.text, chunk_id: r.chunk_id, box: r.box }));
  }, [allRegions, studyAid]);

  const displayFlowchart = useMemo(() => {
    if (studyAid?.diagram_explanations?.length > 0) return studyAid.diagram_explanations;
    const diagRegs = allRegions.filter((r) => r.type === "flowchart" || r.type === "diagram");
    return diagRegs.map((r) => ({
      title: r.type === "flowchart" ? "FLOWCHART IN WORDS" : "DIAGRAM EXPLANATION",
      verbal_description: r.text,
      source_page: r.page || 1,
      source_chunk_id: r.chunk_id,
      source_box: r.box,
    }));
  }, [studyAid, allRegions]);

  const displayQuiz = useMemo(() => {
    if (quiz?.length > 0) return quiz;
    if (allRegions.length === 0) return [];
    const generated = [];
    allRegions.slice(0, 10).forEach((r, idx) => {
      const qNum = idx + 1;
      const cleanSnippet = (r.text || "").replace(/^[*\-\u2022\d.)\s]+/, "").trim();
      if (!cleanSnippet || cleanSnippet.length < 3) return;
      if (r.type === "equation") {
        generated.push({ id: `q${qNum}`, type: "mcq", question: `Which equation appears on page ${r.page || 1}?`, options: [cleanSnippet, `Inverted: 1/(${cleanSnippet.slice(0, 20)})`, `Differential form`, `None of the above`], correct_answer: cleanSnippet, source_page: r.page || 1, source_chunk_id: r.chunk_id, source_box: r.box });
      } else if (idx % 3 === 0) {
        generated.push({ id: `q${qNum}`, type: "short_answer", question: `Explain the concept from page ${r.page || 1}: "${cleanSnippet.slice(0, 60)}"`, options: null, correct_answer: cleanSnippet, source_page: r.page || 1, source_chunk_id: r.chunk_id, source_box: r.box });
      } else {
        generated.push({ id: `q${qNum}`, type: "mcq", question: `According to page ${r.page || 1}, which statement is directly documented?`, options: [cleanSnippet, `Opposite of "${cleanSnippet.slice(0, 25)}"`, `External unreferenced rule`, `Not stated in notes`], correct_answer: cleanSnippet, source_page: r.page || 1, source_chunk_id: r.chunk_id, source_box: r.box });
      }
    });
    return generated;
  }, [quiz, allRegions]);

  const score = displayQuiz.filter((q) => selectedAnswers[q.id] === q.correct_answer).length;
  const answered = Object.keys(selectedAnswers).length;
  const total = displayQuiz.length;
  const scorePercent = total ? Math.round((score / total) * 100) : 0;

  return (
    <div className="w-full flex-1 flex flex-col gap-0 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 border border-slate-200 bg-white rounded-2xl flex items-center justify-center cursor-pointer shadow-sm hover:bg-slate-50 active:scale-95 transition-all shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-tight m-0">Study Set</h2>
            <p className="text-xs text-slate-500 mt-0.5">Grounded in your uploaded notes</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-center">
          {["summary", "quiz"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer capitalize ${activeTab === tab ? "bg-white text-indigo-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
              {tab === "quiz" ? `Quiz (${total})` : "Summary"}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY TAB */}
      {activeTab === "summary" && (
        <div className="flex flex-col gap-5">
          {displaySections.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">📖 Key Concepts</h3>
              <div className="flex flex-col gap-3">{displaySections.map((sec, idx) => <ConceptCard key={idx} sec={sec} idx={idx} onViewSource={onOpenSourceModal} />)}</div>
            </section>
          )}
          {displayEquations.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">∑ Equations</h3>
              <div className="flex flex-col gap-3">{displayEquations.map((eq, idx) => <EquationCard key={idx} eq={eq} onViewSource={onOpenSourceModal} />)}</div>
            </section>
          )}
          {displayImportant.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">★ Key Highlights</h3>
              <div className="flex flex-col gap-3">{displayImportant.map((imp, idx) => <ImportantCard key={idx} imp={imp} onViewSource={onOpenSourceModal} />)}</div>
            </section>
          )}
          {displayFlowchart.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">🔁 Diagrams</h3>
              <div className="flex flex-col gap-3">{displayFlowchart.map((fc, idx) => <FlowchartCard key={idx} fc={fc} onViewSource={onOpenSourceModal} />)}</div>
            </section>
          )}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 p-4 flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Audio Assistant</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{voiceState?.lastAnswer?.text || "Ask any question about your notes using voice or the input bar below…"}</p>
            </div>
            {voiceState?.lastAnswer?.text && (
              <button onClick={() => onSpeakAnswer(voiceState.lastAnswer.text)} aria-label="Play answer aloud" className="shrink-0 w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all cursor-pointer shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 010 6" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* QUIZ TAB */}
      {activeTab === "quiz" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{answered < total ? `${answered} of ${total} answered` : "Quiz complete 🎉"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Score: <span className="font-bold text-indigo-600">{score}</span> / {total}{answered > 0 && <span className="ml-2 text-slate-400">({scorePercent}%)</span>}</p>
              </div>
              <Badge color={scorePercent >= 70 ? "teal" : scorePercent >= 40 ? "amber" : "indigo"}>
                {scorePercent >= 70 ? "🏆 Great" : scorePercent >= 40 ? "📈 Good" : "📚 Keep going"}
              </Badge>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700" style={{ width: total ? `${(answered / total) * 100}%` : "0%" }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Tap "Pg X" on any card to view the source in your notes.</p>
          </div>

          {displayQuiz.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">No quiz questions yet. Upload notes and generate a study set.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {displayQuiz.map((q, idx) => (
                <QuizCard key={q.id || idx} q={q} idx={idx} selectedAnswers={selectedAnswers} shortAnswers={shortAnswers} setShortAnswers={setShortAnswers} onSelectOption={handleSelectOption} onShortSubmit={handleShortAnswerSubmit} onViewSource={onOpenSourceModal} />
              ))}
            </div>
          )}

          {answered === total && total > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white text-center flex flex-col gap-2 shadow-lg">
              <p className="text-3xl font-black">{scorePercent}%</p>
              <p className="text-sm font-semibold opacity-90">{scorePercent >= 80 ? "Excellent! You've mastered these notes." : scorePercent >= 60 ? "Good effort! Review the flagged questions." : "Keep studying — you're making progress!"}</p>
            </div>
          )}
        </div>
      )}

      {/* Sticky Voice Bar */}
      <div className="pt-4 mt-2 sticky bottom-0 bg-gradient-to-t from-[#F5F6FB] via-[#F5F6FB] to-transparent pb-1">
        <form onSubmit={handleVoiceBarSubmit} className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2 shadow-md">
          <input type="text" value={typedQuestion} onChange={(e) => setTypedQuestion(e.target.value)} placeholder="Ask anything about your notes…" className="flex-1 h-11 sm:h-12 rounded-xl border-0 bg-slate-50 px-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-all" />
          <button type="submit" disabled={!typedQuestion.trim()} className="h-11 sm:h-12 px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hidden sm:flex items-center gap-1.5">Ask</button>
          <button type="button" onClick={voiceState?.isListening ? onStopListening : onStartListening} aria-label="Ask by voice" className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all ${voiceState?.isListening ? "bg-rose-600 text-white ring-4 ring-rose-400/40 animate-pulse" : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
