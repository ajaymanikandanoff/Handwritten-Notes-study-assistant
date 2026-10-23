import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  FileText, 
  Layers, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Filter,
  Maximize2,
  Trash2
} from "lucide-react";
import { getImageUrl } from "../services/api";

const TYPE_COLORS = {
  "sentence": { border: "border-blue-500", bg: "bg-blue-500/20", text: "text-blue-400", badge: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  "equation": { border: "border-purple-500", bg: "bg-purple-500/20", text: "text-purple-400", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  "marked-important": { border: "border-amber-500", bg: "bg-amber-500/25", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  "flowchart": { border: "border-cyan-500", bg: "bg-cyan-500/20", text: "text-cyan-400", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  "diagram": { border: "border-emerald-500", bg: "bg-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

function formatBoxCoordinates(b) {
  if (!b) return "0, 0, 100, 100";
  if (Array.isArray(b)) return b.join(", ");
  return `${b.x ?? 0}, ${b.y ?? 0}, ${b.width ?? 0}, ${b.height ?? 0}`;
}

export default function UploadSection({
  pages,
  activePageIndex,
  setActivePageIndex,
  onUploadFiles,
  onGenerate,
  onAnalyzeSinglePage,
  onAnalyzeBatch,
  analyzingPageSet = new Set(),
  isAnalyzing,
  isGenerating,
  darkMode,
  highlightRegion,
  setHighlightRegion,
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [hoveredChunk, setHoveredChunk] = useState(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 1, height: 1 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ width: 1, height: 1 });

  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  const activePage = pages[activePageIndex] || null;
  const isCurrentPageAnalyzing = activePage ? analyzingPageSet.has(activePage.page) : false;
  const isCurrentPageAnalyzed = activePage && activePage.regions && activePage.regions.length > 0;
  const unanalyzedCount = pages.filter((p) => !p.regions || p.regions.length === 0).length;

  // Track image display size for scaling bounding boxes
  const updateImageDimensions = () => {
    if (imageRef.current) {
      setImgDisplaySize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
      setImgNaturalSize({
        width: imageRef.current.naturalWidth || activePage?.width || 800,
        height: imageRef.current.naturalHeight || activePage?.height || 1000,
      });
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateImageDimensions);
    return () => window.removeEventListener("resize", updateImageDimensions);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Filter regions based on active category
  const filteredRegions = (activePage?.regions || []).filter((r) => {
    if (activeFilter === "all") return true;
    return r.type === activeFilter;
  });

  const scaleX = imgDisplaySize.width / (imgNaturalSize.width || 1);
  const scaleY = imgDisplaySize.height / (imgNaturalSize.height || 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Dropzone */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              Upload Handwritten Note Pages or PDF
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload photos or multi-page PDF documents of handwritten notes. Instant preview with on-demand Vision AI.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf,.pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {pages.length > 0 ? "Add More Pages / PDF" : "Select Photos or PDF"}
            </button>

            {pages.length > 0 && (
              <button
                onClick={onGenerate}
                disabled={isGenerating || isAnalyzing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? "Synthesizing..." : "Generate Study & Quiz"}
              </button>
            )}
          </div>
        </div>

        {/* Empty State / Drag and Drop Area */}
        {pages.length === 0 && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-6 border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              darkMode 
                ? "border-slate-700 hover:border-indigo-500 bg-slate-900/30" 
                : "border-slate-300 hover:border-indigo-500 bg-slate-50/50"
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7" />
            </div>
            <p className="font-semibold text-base">Drag & drop your handwritten notes or PDF here</p>
            <p className="text-xs text-slate-400 mt-1">Supports PDF (multi-page), JPG, PNG, WEBP notebook scans.</p>
          </div>
        )}
      </div>

      {/* Multi-page Navigation Bar & On-Demand Batch Toolbar */}
      {pages.length > 0 && (
        <div className={`p-4 rounded-2xl border ${
          darkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"
        }`}>
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-700/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">
                Document: <span className="text-indigo-400">{pages.length} Pages</span>
              </span>
              {unanalyzedCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {unanalyzedCount} ready to analyze
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activePage && !isCurrentPageAnalyzed && !isCurrentPageAnalyzing && (
                <button
                  onClick={() => onAnalyzeSinglePage(activePage.page)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze Page {activePage.page} (2 sec)
                </button>
              )}

              {unanalyzedCount > 1 && (
                <button
                  onClick={() => onAnalyzeBatch(5)}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze Next 5 Pages
                </button>
              )}

              {unanalyzedCount > 5 && (
                <button
                  onClick={() => onAnalyzeBatch("all")}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  Analyze All ({pages.length})
                </button>
              )}
            </div>
          </div>

          {/* Page Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {pages.map((p, idx) => {
              const isAnalyzingThis = analyzingPageSet.has(p.page);
              const hasRegions = p.regions && p.regions.length > 0;
              const isSelected = activePageIndex === idx;

              return (
                <button
                  key={p.page}
                  onClick={() => setActivePageIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                      : darkMode
                      ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isAnalyzingThis ? (
                    <span className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>P{p.page}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-indigo-700 text-white"
                      : hasRegions
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-700/40 text-slate-400"
                  }`}>
                    {isAnalyzingThis ? "Analyzing..." : hasRegions ? `${p.regions.length} reg` : "Ready"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Scanned Note View with Bounding Boxes */}
      {activePage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Note Image & SVG/Canvas Bounding Box Overlay (Left 2 cols) */}
          <div className={`lg:col-span-2 p-5 rounded-2xl border ${
            darkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-white border-slate-200"
          }`}>
            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filter Regions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["all", "sentence", "equation", "marked-important", "flowchart", "diagram"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveFilter(type)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        activeFilter === type
                          ? "bg-indigo-600 text-white shadow"
                          : darkMode
                          ? "bg-slate-800 text-slate-400 hover:text-slate-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {type.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowBoxes(!showBoxes)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                  showBoxes
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "bg-slate-800/40 border-slate-700 text-slate-400"
                }`}
              >
                {showBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showBoxes ? "Hide Boxes" : "Show Boxes"}
              </button>
            </div>

            {/* Note Canvas Container */}
            <div className="relative overflow-hidden rounded-xl bg-slate-950/40 border border-slate-800 flex justify-center items-center select-none min-h-[500px]">
              <img
                ref={imageRef}
                src={getImageUrl(activePage.filename)}
                alt={`Note Page ${activePage.page}`}
                onLoad={updateImageDimensions}
                className="max-h-[750px] w-auto object-contain block"
              />

              {/* On-Demand Analysis Callout Banner if Page not yet analyzed */}
              {!isCurrentPageAnalyzed && (
                <div className="absolute top-4 inset-x-4 p-3.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 backdrop-blur-md flex items-center justify-between gap-3 shadow-xl">
                  <div className="flex items-center gap-2.5">
                    {isCurrentPageAnalyzing ? (
                      <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-xs font-medium text-slate-200">
                      {isCurrentPageAnalyzing 
                        ? `Analyzing Page ${activePage.page} with Vision AI...` 
                        : `Page ${activePage.page} preview loaded. Click Analyze to detect equations & diagrams.`}
                    </span>
                  </div>

                  {!isCurrentPageAnalyzing && (
                    <button
                      onClick={() => onAnalyzeSinglePage(activePage.page)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow"
                    >
                      Analyze Page {activePage.page}
                    </button>
                  )}
                </div>
              )}

              {/* Bounding Box Overlay Layer */}
              {showBoxes && (
                <div className="absolute inset-0 pointer-events-none">
                  {filteredRegions.map((region) => {
                    const box = region.box;
                    const [left, top, right, bottom] = Array.isArray(box)
                      ? box
                      : [
                          ((box?.x ?? 0) / 1000) * (activePage.width || 800),
                          ((box?.y ?? 0) / 1000) * (activePage.height || 1000),
                          (((box?.x ?? 0) + (box?.width ?? 100)) / 1000) * (activePage.width || 800),
                          (((box?.y ?? 0) + (box?.height ?? 100)) / 1000) * (activePage.height || 1000)
                        ];
                    const w = Math.max(12, (right - left) * scaleX);
                    const h = Math.max(12, (bottom - top) * scaleY);
                    const x = left * scaleX;
                    const y = top * scaleY;

                    const color = TYPE_COLORS[region.type] || TYPE_COLORS.sentence;
                    const isHovered = hoveredChunk === region.chunk_id;
                    const isHighlighted = highlightRegion?.chunk_id === region.chunk_id;

                    return (
                      <div
                        key={region.chunk_id}
                        onMouseEnter={() => setHoveredChunk(region.chunk_id)}
                        onMouseLeave={() => setHoveredChunk(null)}
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          width: `${w}px`,
                          height: `${h}px`,
                        }}
                        className={`absolute border-2 rounded pointer-events-auto cursor-pointer transition-all duration-150 ${color.border} ${
                          isHighlighted 
                            ? "border-red-500 bg-red-500/30 ring-4 ring-red-500/50 z-30 animate-source-highlight"
                            : isHovered
                            ? "bg-white/20 z-20 shadow-lg scale-[1.01]"
                            : color.bg
                        }`}
                      >
                        {/* Region Tag Pill */}
                        <div className={`absolute -top-3 left-1 text-[10px] font-bold px-1.5 py-0.2 rounded shadow backdrop-blur-md border ${color.badge}`}>
                          {region.type} ({region.chunk_id})
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Region Inspector Sidebar (Right col) */}
          <div className={`p-5 rounded-2xl border flex flex-col h-[750px] ${
            darkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Detected Regions ({filteredRegions.length})
              </h3>
              <span className="text-xs text-slate-400">Page {activePage.page}</span>
            </div>

            {/* List of Regions with click to highlight */}
            <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1">
              {filteredRegions.map((region) => {
                const color = TYPE_COLORS[region.type] || TYPE_COLORS.sentence;
                const isHovered = hoveredChunk === region.chunk_id;
                const isHighlighted = highlightRegion?.chunk_id === region.chunk_id;

                return (
                  <div
                    key={region.chunk_id}
                    onMouseEnter={() => setHoveredChunk(region.chunk_id)}
                    onMouseLeave={() => setHoveredChunk(null)}
                    onClick={() => setHighlightRegion(region)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isHighlighted
                        ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30"
                        : isHovered
                        ? "border-indigo-500 bg-indigo-500/10"
                        : darkMode
                        ? "bg-slate-900/40 border-slate-700/60 hover:border-slate-600"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded font-mono font-semibold uppercase text-[10px] border ${color.badge}`}>
                        {region.type}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">{region.chunk_id}</span>
                    </div>

                    <p className="line-clamp-3 text-slate-300 font-medium">
                      {region.text || "[No transcription]"}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Box: [{formatBoxCoordinates(region.box)}]</span>
                      <span>Conf: {Math.round(region.confidence * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
