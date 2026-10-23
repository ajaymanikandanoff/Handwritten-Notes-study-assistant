import React from "react";
import { 
  Sparkles, 
  AlertTriangle, 
  Variable, 
  GitBranch, 
  ExternalLink, 
  BookMarked,
  Layers,
  ChevronRight
} from "lucide-react";

export default function StudyAidView({ studyAid, onVerifySource, darkMode }) {
  if (!studyAid) {
    return (
      <div className={`p-12 text-center rounded-2xl border ${
        darkMode ? "bg-slate-800/40 border-slate-700/60 text-slate-400" : "bg-white border-slate-200 text-slate-500"
      }`}>
        <Sparkles className="w-12 h-12 mx-auto text-indigo-400 mb-3 opacity-60" />
        <h3 className="text-lg font-bold">No Study Aid Generated Yet</h3>
        <p className="text-sm mt-1">Upload your notes and click "Generate Study & Quiz" to view breakdowns.</p>
      </div>
    );
  }

  const { summary, sections = [], equation_breakdowns = [], diagram_explanations = [] } = studyAid;

  return (
    <div className="space-y-6">
      {/* Overview Summary */}
      <div className={`p-6 rounded-2xl border bg-gradient-to-br transition-all ${
        darkMode 
          ? "from-indigo-950/40 to-slate-900 border-indigo-500/20 shadow-lg shadow-indigo-950/30" 
          : "from-indigo-50 to-white border-indigo-100 shadow-sm"
      }`}>
        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          Executive Overview
        </div>
        <p className="text-base text-slate-200 font-normal leading-relaxed">
          {summary}
        </p>
      </div>

      {/* High-Priority Concepts & Marked-Important Notes */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          High-Priority Concepts & Marked Important
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((sec, idx) => {
            const isHigh = sec.importance === "high";
            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  isHigh
                    ? darkMode
                      ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50"
                      : "bg-amber-50/80 border-amber-200 hover:border-amber-300"
                    : darkMode
                    ? "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <BookMarked className={`w-4 h-4 ${isHigh ? "text-amber-400" : "text-indigo-400"}`} />
                    {sec.title}
                  </h4>
                  {isHigh && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      EXAM PRIORITY
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {sec.content}
                </p>

                {sec.source_chunk_ids && sec.source_chunk_ids.length > 0 && (
                  <div className="mt-4 pt-2.5 border-t border-slate-700/40 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Chunk: {sec.source_chunk_ids.join(", ")}
                    </span>
                    <button
                      onClick={() => onVerifySource(sec.source_chunk_ids[0], 1, null, sec.source_chunk_ids.map(cid => ({ chunk_id: cid })))}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Verify in Notes
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step-by-Step Equation Breakdowns */}
      {equation_breakdowns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
            <Variable className="w-4 h-4" />
            Step-by-Step Equation Breakdowns
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equation_breakdowns.map((eq, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  darkMode ? "bg-purple-950/20 border-purple-500/30" : "bg-purple-50/70 border-purple-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-base font-mono font-bold text-purple-300 bg-purple-900/30 px-3 py-1.5 rounded-xl border border-purple-500/30">
                    {eq.equation}
                  </div>
                  <button
                    onClick={() => onVerifySource(eq.source_chunk_id, eq.source_page, eq.source_box)}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Page {eq.source_page || 1}
                  </button>
                </div>

                <p className="text-xs text-slate-300 font-medium mb-3">
                  <span className="text-purple-400 font-semibold">Physical Meaning: </span>
                  {eq.meaning}
                </p>

                {eq.step_by_step && eq.step_by_step.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-slate-900/50 p-3 rounded-xl border border-purple-500/20">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Step-by-Step Derivation / Application:</span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                      {eq.step_by_step.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verbal Diagrams & Flowcharts */}
      {diagram_explanations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Diagrams & Flowcharts Verbal Descriptions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {diagram_explanations.map((diag, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all ${
                  darkMode ? "bg-cyan-950/20 border-cyan-500/30" : "bg-cyan-50/70 border-cyan-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    {diag.title}
                  </h4>
                  <button
                    onClick={() => onVerifySource(diag.source_chunk_id, diag.source_page, diag.source_box)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Page {diag.source_page || 1}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {diag.verbal_description}
                </p>

                {diag.key_components && diag.key_components.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-cyan-500/20">
                    {diag.key_components.map((c, cIdx) => (
                      <span key={cIdx} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
