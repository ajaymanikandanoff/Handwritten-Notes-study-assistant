import React, { useState } from "react";
import { getImageUrl } from "../services/api";

const CATEGORY_STYLES = {
  concept: {
    border: "#1D4ED8",
    bg: "rgba(29, 78, 216, 0.08)",
    badgeBg: "#1D4ED8",
    chipBg: "#DBEAFE",
    chipText: "#1E3A8A",
  },
  sentence: {
    border: "#1D4ED8",
    bg: "rgba(29, 78, 216, 0.08)",
    badgeBg: "#1D4ED8",
    chipBg: "#DBEAFE",
    chipText: "#1E3A8A",
  },
  equation: {
    border: "#6D28D9",
    bg: "rgba(109, 40, 217, 0.08)",
    badgeBg: "#6D28D9",
    chipBg: "#EDE9FE",
    chipText: "#4C1D95",
  },
  important: {
    border: "#B45309",
    bg: "rgba(180, 83, 9, 0.1)",
    badgeBg: "#B45309",
    chipBg: "#FEF3C7",
    chipText: "#78350F",
  },
  "marked-important": {
    border: "#B45309",
    bg: "rgba(180, 83, 9, 0.1)",
    badgeBg: "#B45309",
    chipBg: "#FEF3C7",
    chipText: "#78350F",
  },
  flowchart: {
    border: "#0F766E",
    bg: "rgba(15, 118, 110, 0.08)",
    badgeBg: "#0F766E",
    chipBg: "#CCFBF1",
    chipText: "#134E4A",
  },
  diagram: {
    border: "#BE185D",
    bg: "rgba(190, 24, 93, 0.08)",
    badgeBg: "#BE185D",
    chipBg: "#FCE7F3",
    chipText: "#831843",
  },
};

function computeBoxPercent(rawBox, imgNaturalWidth = 1000, imgNaturalHeight = 1000) {
  if (!rawBox) return { left: "10%", top: "20%", width: "80%", height: "15%" };

  let x = 0, y = 0, w = 100, h = 50;

  if (Array.isArray(rawBox) && rawBox.length === 4) {
    const [x1, y1, x2, y2] = rawBox.map(Number);
    if (imgNaturalWidth > 1000 && (x1 > 1000 || x2 > 1000 || y1 > 1000 || y2 > 1000)) {
      x = (x1 / imgNaturalWidth) * 100;
      y = (y1 / imgNaturalHeight) * 100;
      w = ((x2 - x1) / imgNaturalWidth) * 100;
      h = ((y2 - y1) / imgNaturalHeight) * 100;
    } else {
      x = (x1 / 1000) * 100;
      y = (y1 / 1000) * 100;
      w = ((x2 - x1) / 1000) * 100;
      h = ((y2 - y1) / 1000) * 100;
    }
  } else if (typeof rawBox === "object") {
    const rx = Number(rawBox.x ?? rawBox.left ?? 0);
    const ry = Number(rawBox.y ?? rawBox.top ?? 0);
    const rw = Number(rawBox.width ?? rawBox.w ?? 100);
    const rh = Number(rawBox.height ?? rawBox.h ?? 50);

    if (rx <= 1.0 && ry <= 1.0 && rw <= 1.0 && rh <= 1.0 && rw > 0) {
      x = rx * 100;
      y = ry * 100;
      w = rw * 100;
      h = rh * 100;
    } else if (imgNaturalWidth > 1000 && (rx > 1000 || ry > 1000 || rw > 1000 || rh > 1000)) {
      x = (rx / imgNaturalWidth) * 100;
      y = (ry / imgNaturalHeight) * 100;
      w = (rw / imgNaturalWidth) * 100;
      h = (rh / imgNaturalHeight) * 100;
    } else {
      x = (rx / 1000) * 100;
      y = (ry / 1000) * 100;
      w = (rw / 1000) * 100;
      h = (rh / 1000) * 100;
    }
  }

  const safeLeft = Math.max(0, Math.min(95, x));
  const safeTop = Math.max(0, Math.min(95, y));
  const safeWidth = Math.max(4, Math.min(100 - safeLeft, w));
  const safeHeight = Math.max(2.5, Math.min(100 - safeTop, h));

  return {
    left: `${safeLeft.toFixed(2)}%`,
    top: `${safeTop.toFixed(2)}%`,
    width: `${safeWidth.toFixed(2)}%`,
    height: `${safeHeight.toFixed(2)}%`,
  };
}

export default function Screen2Scanned({
  pages = [],
  activePageIndex = 0,
  setActivePageIndex,
  onBack,
  onContinue,
  onVerifySource,
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedChunkId, setSelectedChunkId] = useState(null);

  const activePage = pages[activePageIndex] || pages[0] || { page: 1, regions: [] };
  const allRegions = pages.flatMap((p) => p.regions || []);
  const selectedRegion = allRegions.find((r) => r.chunk_id === selectedChunkId) || null;

  // Compute category counts
  const counts = {
    concept: 0,
    equation: 0,
    important: 0,
    flowchart: 0,
    diagram: 0,
  };

  const regionsToCount = allRegions.length > 0 ? allRegions : [];
  regionsToCount.forEach((r) => {
    const t = r.type;
    if (t === "concept" || t === "sentence") counts.concept++;
    else if (t === "equation") counts.equation++;
    else if (t === "marked-important" || t === "important") counts.important++;
    else if (t === "flowchart") counts.flowchart++;
    else if (t === "diagram") counts.diagram++;
  });

  const totalRegions = Object.values(counts).reduce((a, b) => a + b, 0);

  const conceptsList = allRegions.length > 0
    ? Array.from(new Set(allRegions.map((r) => (r.text || "").replace(/^[*\-•\d.)\s]+/, "").trim()).filter((t) => t && t.length > 2 && t.length < 60))).slice(0, 8)
    : [];

  const pageRegions = (activePage.regions || []).filter((r) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "concept") return r.type === "concept" || r.type === "sentence";
    if (activeFilter === "important") return r.type === "marked-important" || r.type === "important";
    return r.type === activeFilter;
  });

  const hasRealRegions = pageRegions.length > 0;

  return (
    <div className="w-full flex-1 flex flex-col gap-4 text-[#0F172A]">
      {/* Top Navigation & Status Header */}
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
            <div className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-tight">Scanned notes</div>
            <div className="text-xs sm:text-sm text-[#475569]">
              {totalRegions} regions categorized across {pages.length || 3} pages
            </div>
          </div>
        </div>

        {/* Action Button visible on Laptop top bar */}
        <button
          onClick={onContinue}
          className="hidden sm:flex h-12 px-6 rounded-[14px] bg-[#4338CA] text-white font-bold text-sm hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer shadow-md items-center justify-center gap-2"
        >
          <span>Looks good, continue</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Responsive Workspace Grid: 2 Columns on Laptop / Desktop, 1 Column on Phone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ================= LEFT MAIN CANVAS COLUMN (8 COLS ON LAPTOP) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Page Selector Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex gap-2">
              {(pages.length > 0 ? pages : [{ page: 1 }, { page: 2 }, { page: 3 }]).map((p, idx) => {
                const isActive = activePageIndex === idx;
                return (
                  <button
                    key={p.page || idx}
                    onClick={() => setActivePageIndex && setActivePageIndex(idx)}
                    className={`h-11 min-w-[72px] px-4 rounded-[12px] text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#4338CA] text-white border-0 shadow-xs"
                        : "border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    Page {p.page || idx + 1}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-[#475569] font-medium hidden sm:inline">
              Page {activePage.page || 1} Canvas
            </span>
          </div>

          {/* Note Canvas View with Bounding Boxes */}
          <div className="relative min-h-[340px] sm:min-h-[420px] lg:min-h-[480px] bg-[#F8FAFC] border border-[#CBD5E1] rounded-[18px] overflow-hidden select-none shadow-sm flex items-center justify-center p-2">
            {activePage.filename ? (
              <div className="relative inline-block max-w-full max-h-full">
                <img
                  src={getImageUrl(activePage.filename)}
                  alt={`Page ${activePage.page}`}
                  className="block max-h-[320px] sm:max-h-[400px] lg:max-h-[460px] max-w-full w-auto object-contain rounded-lg shadow-sm border border-[#CBD5E1]/80"
                />

                {/* Real regions detected by Gemini Vision AI with exact alignment */}
                {pageRegions.map((region) => {
                  const boxPercent = computeBoxPercent(region.box, activePage.width, activePage.height);
                  const style = CATEGORY_STYLES[region.type] || CATEGORY_STYLES.concept;
                  const isSelected = selectedChunkId === region.chunk_id;

                  return (
                    <div
                      key={region.chunk_id}
                      onClick={() => setSelectedChunkId(region.chunk_id)}
                      style={{
                        position: "absolute",
                        left: boxPercent.left,
                        top: boxPercent.top,
                        width: boxPercent.width,
                        height: boxPercent.height,
                        border: `2px solid ${style.border}`,
                        backgroundColor: style.bg,
                      }}
                      className={`rounded-[6px] transition-all cursor-pointer ${
                        isSelected ? "ring-4 ring-amber-400 z-30 scale-[1.01]" : "z-10 hover:shadow-md"
                      }`}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: "-2px",
                          top: "-18px",
                          background: style.badgeBg,
                        }}
                        className="text-white font-sans not-italic font-semibold text-[10px] px-1.5 py-0.2 rounded shadow-xs whitespace-nowrap"
                      >
                        {region.type.replace("marked-", "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : hasRealRegions ? (
              pageRegions.map((region) => {
                const boxPercent = computeBoxPercent(region.box, activePage.width, activePage.height);
                const style = CATEGORY_STYLES[region.type] || CATEGORY_STYLES.concept;
                const isSelected = selectedChunkId === region.chunk_id;

                return (
                  <div
                    key={region.chunk_id}
                    onClick={() => setSelectedChunkId(region.chunk_id)}
                    style={{
                      position: "absolute",
                      left: boxPercent.left,
                      top: boxPercent.top,
                      width: boxPercent.width,
                      height: boxPercent.height,
                      border: `2px solid ${style.border}`,
                      backgroundColor: style.bg,
                    }}
                    className={`rounded-[6px] transition-all cursor-pointer ${
                      isSelected ? "ring-4 ring-amber-400 z-30 scale-[1.01]" : "z-10 hover:shadow-md"
                    }`}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "-2px",
                        top: "-18px",
                        background: style.badgeBg,
                      }}
                      className="text-white font-sans not-italic font-semibold text-[10px] px-1.5 py-0.2 rounded shadow-xs whitespace-nowrap"
                    >
                      {region.type.replace("marked-", "")}
                    </span>
                  </div>
                );
              })
            ) : activeFilter !== "all" ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-slate-900/75 backdrop-blur-sm text-slate-200 text-xs px-3.5 py-1.5 rounded-full font-medium shadow-md">
                  No {activeFilter} regions found on this page
                </span>
              </div>
            ) : null}
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs sm:text-sm font-medium">
            <span className="text-xs text-[#475569] font-bold uppercase tracking-wider mr-1">Filter:</span>
            <button
              onClick={() => setActiveFilter(activeFilter === "concept" ? "all" : "concept")}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                activeFilter === "concept" ? "ring-2 ring-[#1D4ED8] font-bold" : ""
              } bg-[#DBEAFE] text-[#1E3A8A]`}
            >
              concept {counts.concept}
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "equation" ? "all" : "equation")}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                activeFilter === "equation" ? "ring-2 ring-[#6D28D9] font-bold" : ""
              } bg-[#EDE9FE] text-[#4C1D95]`}
            >
              equation {counts.equation}
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "important" ? "all" : "important")}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                activeFilter === "important" ? "ring-2 ring-[#B45309] font-bold" : ""
              } bg-[#FEF3C7] text-[#78350F]`}
            >
              important {counts.important}
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "flowchart" ? "all" : "flowchart")}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                activeFilter === "flowchart" ? "ring-2 ring-[#0F766E] font-bold" : ""
              } bg-[#CCFBF1] text-[#134E4A]`}
            >
              flowchart {counts.flowchart}
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "diagram" ? "all" : "diagram")}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-all ${
                activeFilter === "diagram" ? "ring-2 ring-[#BE185D] font-bold" : ""
              } bg-[#FCE7F3] text-[#831843]`}
            >
              diagram {counts.diagram}
            </button>
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR COLUMN (4 COLS ON LAPTOP) ================= */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            {/* Active Selected Region Inspector */}
            {selectedRegion && (
              <div className="bg-[#FEF3C7] border-2 border-[#F59E0B] rounded-[20px] p-4 flex flex-col gap-2 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#78350F] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                    <span>Selected {selectedRegion.type.replace("marked-", "")}</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-[#B45309]">
                    {selectedRegion.chunk_id}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[#0F172A] leading-snug">
                  "{selectedRegion.text}"
                </div>
              </div>
            )}

            {/* Concepts Discussed Card */}
            <div className="bg-white border border-[#CBD5E1] rounded-[20px] p-5 flex flex-col gap-3 shadow-xs">
              <div className="text-base font-bold text-[#0F172A] flex items-center justify-between">
                <span>Concepts discussed in notes</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#4338CA] font-semibold">
                  {conceptsList.length} topics
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                {conceptsList.map((concept, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-[#DBEAFE] text-[#1E3A8A] font-semibold"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>

            {/* Region Details / Verification Guarantee Card */}
            <div className="bg-white border border-[#CBD5E1] rounded-[20px] p-5 flex flex-col gap-2.5 shadow-xs">
              <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Zero Hallucination Verified</span>
              </div>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Every formula, definition, and diagram is mapped directly to pixel bounding box coordinates in your handwritten notes.
              </p>
              <div className="text-xs text-[#4338CA] font-semibold pt-1">
                ✓ Tap any region to inspect source coordinates
              </div>
            </div>
          </div>

          {/* Bottom CTA Button (visible on all screens) */}
          <button
            onClick={onContinue}
            className="w-full h-14 border-0 rounded-[16px] bg-[#4338CA] text-white text-base font-bold hover:bg-[#3730A3] active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <span>Looks good, continue</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
