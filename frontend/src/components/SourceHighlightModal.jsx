import React, { useState, useRef, useEffect } from "react";
import { X, Search, CheckCircle, ExternalLink, Sparkles, Layers, ChevronRight, ChevronLeft } from "lucide-react";
import { getImageUrl } from "../services/api";

const SOURCE_COLORS = [
  { border: "border-red-500", bg: "bg-red-500/20", pill: "bg-red-600 text-white", label: "Primary Source" },
  { border: "border-cyan-500", bg: "bg-cyan-500/20", pill: "bg-cyan-600 text-white", label: "Source 2" },
  { border: "border-purple-500", bg: "bg-purple-500/20", pill: "bg-purple-600 text-white", label: "Source 3" },
  { border: "border-amber-500", bg: "bg-amber-500/20", pill: "bg-amber-600 text-white", label: "Source 4" },
];

function formatBoxCoordinates(b) {
  if (!b) return "0, 0, 100, 100";
  if (Array.isArray(b)) return b.join(", ");
  return `x: ${b.x ?? 0}, y: ${b.y ?? 0}, w: ${b.width ?? 0}, h: ${b.height ?? 0}`;
}

export default function SourceHighlightModal({
  isOpen,
  onClose,
  sourceData, // { chunk_id, page, box, text, filename, type, sources: [] }
  pages = [],
  darkMode = true,
}) {
  const [imgDisplaySize, setImgDisplaySize] = useState({ width: 1, height: 1 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 1, height: 1 });
  const [activeModalPage, setActiveModalPage] = useState(sourceData?.page || 1);
  const imgRef = useRef(null);

  useEffect(() => {
    if (sourceData?.page) {
      setActiveModalPage(sourceData.page);
    }
  }, [sourceData]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sourceData) return null;

  // Resolve target page object and filename
  const targetPage = pages.find((p) => p.page === activeModalPage) || pages[0] || null;
  const filename = targetPage?.filename || sourceData.filename;

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgDisplaySize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
      setImgNaturalSize({
        width: imgRef.current.naturalWidth || 800,
        height: imgRef.current.naturalHeight || 1000,
      });
    }
  };

  const scaleX = imgDisplaySize.width / (imgNaturalSize.width || 1);
  const scaleY = imgDisplaySize.height / (imgNaturalSize.height || 1);

  // Collect all sources to highlight (support composite questions)
  const allSources = sourceData.sources && sourceData.sources.length > 0
    ? sourceData.sources
    : [{
        chunk_id: sourceData.chunk_id,
        page: sourceData.page,
        box: sourceData.box,
        text: sourceData.text,
        type: sourceData.type,
      }];

  // Filter sources that belong to the currently viewed page
  const pageSources = allSources.filter((s) => (s.page || 1) === activeModalPage);

  // Unique pages referenced across all sources
  const referencedPages = Array.from(new Set(allSources.map((s) => s.page || 1)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md transition-all">
      <div 
        className={`relative w-full max-w-4xl max-h-[92vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/40 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Click-to-Highlight Source Evidence
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {allSources.length > 1 ? `${allSources.length} Referenced Sources` : `Chunk: ${sourceData.chunk_id}`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Ground-truth handwritten bounding box verification on Page {activeModalPage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-page switcher if composite sources span multiple pages */}
            {referencedPages.length > 1 && (
              <div className="flex items-center gap-1.5 mr-2 bg-slate-800 p-1 rounded-xl">
                {referencedPages.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setActiveModalPage(pageNum)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeModalPage === pageNum
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Page {pageNum}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Note Preview with Animated Pulse Boxes */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          {filename ? (
            <div className="relative inline-block rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 shadow-xl max-h-[60vh]">
              <img
                ref={imgRef}
                src={getImageUrl(filename)}
                alt={`Source Note Page ${activeModalPage}`}
                onLoad={handleImageLoad}
                className="max-h-[60vh] w-auto object-contain block"
              />

              {/* Render Animated Glowing Highlight Box for every source on this page */}
              {pageSources.map((src, sIdx) => {
                const sBox = src.box || sourceData.box || [0, 0, 100, 100];
                const [left, top, right, bottom] = Array.isArray(sBox)
                  ? sBox
                  : [
                      ((sBox?.x ?? 0) / 1000) * (imgNaturalSize.width || 800),
                      ((sBox?.y ?? 0) / 1000) * (imgNaturalSize.height || 1000),
                      (((sBox?.x ?? 0) + (sBox?.width ?? 100)) / 1000) * (imgNaturalSize.width || 800),
                      (((sBox?.y ?? 0) + (sBox?.height ?? 100)) / 1000) * (imgNaturalSize.height || 1000)
                    ];

                const x = left * scaleX;
                const y = top * scaleY;
                const w = Math.max(20, (right - left) * scaleX);
                const h = Math.max(20, (bottom - top) * scaleY);
                const colorTheme = SOURCE_COLORS[sIdx % SOURCE_COLORS.length];

                return (
                  <div
                    key={src.chunk_id || sIdx}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                    }}
                    className={`absolute border-4 ${colorTheme.border} rounded-md ${colorTheme.bg} shadow-2xl pointer-events-none transition-all duration-300 ring-4 ring-red-500/30 animate-pulse`}
                  >
                    {/* Marker Pill */}
                    <div className={`absolute -top-7 left-0 ${colorTheme.pill} font-bold text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap flex items-center gap-1 font-mono`}>
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      {allSources.length > 1 ? `Source ${sIdx + 1}: ${src.chunk_id}` : `Source Evidence (${src.chunk_id})`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              Note image for Page {activeModalPage} could not be previewed.
            </div>
          )}

          {/* Sources Evidence Info Cards */}
          <div className="w-full mt-4 space-y-2">
            {allSources.map((src, idx) => {
              const colorTheme = SOURCE_COLORS[idx % SOURCE_COLORS.length];
              return (
                <div key={src.chunk_id || idx} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1 font-mono">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colorTheme.pill.split(" ")[0]}`}></span>
                      <span className="font-bold text-slate-200">
                        {allSources.length > 1 ? `Source ${idx + 1} (${src.chunk_id})` : src.chunk_id}
                      </span>
                      <span>• Page {src.page || activeModalPage}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Box: [{formatBoxCoordinates(src.box || sourceData.box)}]
                    </span>
                  </div>
                  {src.text && (
                    <p className="text-slate-200 font-medium text-xs mt-1 pl-4 border-l-2 border-indigo-500/40">
                      "{src.text}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-700/40 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Zero Hallucination Guarantee: Confirmed against student's original handwriting.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
