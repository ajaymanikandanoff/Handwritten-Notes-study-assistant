import React, { useState } from "react";
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ExternalLink, 
  Award, 
  RefreshCw,
  Search,
  ChevronRight
} from "lucide-react";
import confetti from "canvas-confetti";

export default function QuizView({ quiz = [], onVerifySource, darkMode }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [revealedExplanations, setRevealedExplanations] = useState({});
  const [shortAnswers, setShortAnswers] = useState({});

  if (!quiz || quiz.length === 0) {
    return (
      <div className={`p-12 text-center rounded-2xl border ${
        darkMode ? "bg-slate-800/40 border-slate-700/60 text-slate-400" : "bg-white border-slate-200 text-slate-500"
      }`}>
        <GraduationCap className="w-12 h-12 mx-auto text-indigo-400 mb-3 opacity-60" />
        <h3 className="text-lg font-bold">No Quiz Generated Yet</h3>
        <p className="text-sm mt-1">Upload note pages and click "Generate Study & Quiz" to start testing your knowledge.</p>
      </div>
    );
  }

  // Calculate score
  let score = 0;
  quiz.forEach((q) => {
    if (selectedAnswers[q.id] && selectedAnswers[q.id] === q.correct_answer) {
      score += 1;
    }
  });

  const totalAnswered = Object.keys(selectedAnswers).length;
  const progressPct = Math.round((totalAnswered / quiz.length) * 100);

  const handleSelectOption = (qId, option, isCorrect) => {
    if (selectedAnswers[qId]) return; // lock once answered

    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
    setRevealedExplanations((prev) => ({ ...prev, [qId]: true }));

    if (isCorrect) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    }
  };

  const handleShortAnswerSubmit = (q) => {
    const userAnswer = (shortAnswers[q.id] || "").trim();
    if (!userAnswer) return;

    setSelectedAnswers((prev) => ({ ...prev, [q.id]: userAnswer }));
    setRevealedExplanations((prev) => ({ ...prev, [q.id]: true }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setRevealedExplanations({});
    setShortAnswers({});
  };

  return (
    <div className="space-y-6">
      {/* Quiz Progress & Score Card */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" />
              Interactive Knowledge Check
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly grounded in your notes • Click any question to verify source coordinates
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Score</div>
              <div className="text-xl font-mono font-bold text-indigo-400">
                {score} / {quiz.length}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset Quiz"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-5">
        {quiz.map((q, idx) => {
          const isAnswered = Boolean(selectedAnswers[q.id]);
          const selectedOption = selectedAnswers[q.id];
          const isCorrect = selectedOption === q.correct_answer;
          const isExplanationOpen = Boolean(revealedExplanations[q.id]);

          return (
            <div
              key={q.id}
              className={`p-6 rounded-2xl border transition-all ${
                darkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-white border-slate-200"
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold font-mono text-xs flex items-center justify-center border border-indigo-500/20">
                    Q{idx + 1}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {q.type === "mcq" ? "Multiple Choice" : "Short Answer"}
                  </span>
                </div>

                {/* Click-to-Highlight Source Verification Button */}
                <button
                  onClick={() => onVerifySource(q.source_chunk_id, q.source_page, q.source_box, q.sources)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
                  title="Click to view original handwritten note page and animated bounding box highlight"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>
                    Verify in Note (Page {q.source_page || 1}{q.sources && q.sources.length > 1 ? ` • ${q.sources.length} sources` : ""})
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>

              {/* Question Prompt */}
              <p className="text-base font-semibold text-slate-100 mb-5 leading-relaxed">
                {q.question}
              </p>

              {/* MCQ Options */}
              {q.type === "mcq" && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {q.options.map((opt, optIdx) => {
                    const isThisSelected = selectedOption === opt;
                    const isThisCorrect = opt === q.correct_answer;

                    let optStyle = darkMode 
                      ? "bg-slate-900/40 border-slate-700 hover:border-slate-500" 
                      : "bg-slate-50 border-slate-200 hover:border-slate-300";

                    if (isAnswered) {
                      if (isThisCorrect) {
                        optStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20";
                      } else if (isThisSelected) {
                        optStyle = "bg-rose-500/15 border-rose-500 text-rose-300 ring-2 ring-rose-500/20";
                      } else {
                        optStyle = "opacity-40 border-slate-800";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(q.id, opt, isThisCorrect)}
                        className={`p-3.5 rounded-xl border text-left text-sm font-medium flex items-center justify-between gap-3 transition-all cursor-pointer disabled:cursor-default ${optStyle}`}
                      >
                        <span className="flex-1">{opt}</span>
                        {isAnswered && isThisCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {isAnswered && isThisSelected && !isThisCorrect && (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Short Answer Input */}
              {q.type === "short_answer" && !isAnswered && (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={shortAnswers[q.id] || ""}
                    onChange={(e) => setShortAnswers({ ...shortAnswers, [q.id]: e.target.value })}
                    placeholder="Type your answer here..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleShortAnswerSubmit(q)}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors cursor-pointer"
                  >
                    Check
                  </button>
                </div>
              )}

              {/* Feedback and Explanation Box */}
              {isExplanationOpen && (
                <div className={`mt-4 p-4 rounded-xl border text-xs leading-relaxed ${
                  isCorrect
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                    : "bg-slate-900/60 border-slate-700/60 text-slate-300"
                }`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    <span>Explanation & Note Evidence:</span>
                  </div>
                  <p>{q.explanation || "Directly stated in the uploaded note text."}</p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                    <span>
                      Primary Chunk: <span className="text-amber-400">{q.source_chunk_id}</span> • Page {q.source_page}
                    </span>
                    {q.sources && q.sources.length > 1 && (
                      <span className="text-cyan-400 font-semibold">
                        Composite: Links {q.sources.map(s => s.chunk_id).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
