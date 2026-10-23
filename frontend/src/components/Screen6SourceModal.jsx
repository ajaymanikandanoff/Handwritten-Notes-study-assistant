import React from "react";
import { getImageUrl } from "../services/api";

/**
 * Accurately compute percentage coordinates for bounding boxes
 * Handles:
 * 1. Normalized 0-1000 scale: { x, y, width, height }
 * 2. Normalized 0.0-1.0 floats: { x, y, width, height }
 * 3. Array [x1, y1, x2, y2]
 * 4. Raw image pixels
 */
function computeBoxPercent(rawBox, imgNaturalWidth = 1000, imgNaturalHeight = 1000) {
  if (!rawBox) {
    return { left: "10%", top: "20%", width: "80%", height: "15%" };
  }

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

  // Ensure box stays safely within image boundaries with minimum visible size
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

export default function Screen6SourceModal({
  isOpen,
  onClose,
  sourceData,
  pages = [],
}) {
  if (!isOpen) return null;

  const pageNum = sourceData?.page || 1;
  const chunkId = sourceData?.chunk_id;
  const questionTitle = sourceData?.questionTitle || "Source Evidence";

  // Find target page in the document
  const targetPage = pages.find((p) => p.page === pageNum) || pages[0] || null;

  // Find the exact region from target page regions
  let matchedRegion = null;
  if (targetPage?.regions?.length > 0) {
    if (chunkId) {
      matchedRegion = targetPage.regions.find((r) => r.chunk_id === chunkId);
    }
    if (!matchedRegion && sourceData?.sources?.length > 0) {
      const firstSrc = sourceData.sources[0];
      matchedRegion = targetPage.regions.find((r) => r.chunk_id === firstSrc.chunk_id);
    }
    if (!matchedRegion) {
      matchedRegion = targetPage.regions[0];
    }
  }

  // Determine active box coordinates
  const activeBox = sourceData?.box || matchedRegion?.box || (targetPage?.regions?.[0]?.box) || null;
  const boxStyles = computeBoxPercent(activeBox, targetPage?.width, targetPage?.height);

  const regionType = matchedRegion?.type || sourceData?.type || "sentence";
  const displayChunkId = chunkId || matchedRegion?.chunk_id || `page-${pageNum}-region-1`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#020617]/85 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Responsive Container: Centered Modal on Laptop, Bottom Sheet on Mobile */}
      <div className="relative z-10 w-full sm:max-w-2xl lg:max-w-3xl bg-[#0F172A] border border-[#1E293B] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 pb-6 flex flex-col gap-4 max-h-[92vh] box-border text-[#F1F5F9] shadow-2xl overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="w-10 h-1 rounded-full bg-[#475569] self-center shrink-0 sm:hidden"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between shrink-0 border-b border-[#1E293B] pb-3">
          <div className="pr-3">
            <div className="text-lg sm:text-xl font-bold text-[#F1F5F9] leading-tight">
              {questionTitle.startsWith("Source") ? questionTitle : `Source Evidence: ${questionTitle}`}
            </div>
            <div className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
              Page {pageNum} • <span className="capitalize">{String(regionType).replace("marked-", "")}</span> region •{" "}
              <span className="text-[#818CF8] font-mono font-semibold">{displayChunkId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] border border-[#334155] bg-[#1E293B] flex items-center justify-center text-[#F1F5F9] hover:bg-[#334155] cursor-pointer transition-colors shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Note Preview Canvas with Accurately Positioned Bounding Box */}
        <div className="relative min-h-[320px] sm:min-h-[420px] max-h-[58vh] bg-[#020617] rounded-[18px] overflow-hidden flex items-center justify-center p-3 select-none border border-[#1E293B] shadow-inner">
          {targetPage?.filename ? (
            /* Inline-block wrapper conformed exactly to the image's rendered dimensions */
            <div className="relative inline-block max-w-full max-h-full">
              <img
                src={getImageUrl(targetPage.filename)}
                alt={`Source Page ${pageNum}`}
                className="block max-h-[300px] sm:max-h-[400px] max-w-full w-auto object-contain rounded-lg shadow-xl border border-[#334155]/60"
              />

              {/* Exact Highlight Overlay Box matching handwritten note passage */}
              <div
                style={{
                  position: "absolute",
                  left: boxStyles.left,
                  top: boxStyles.top,
                  width: boxStyles.width,
                  height: boxStyles.height,
                  border: "3px solid #F59E0B",
                  borderRadius: "6px",
                  backgroundColor: "rgba(245, 158, 11, 0.25)",
                  boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.6), 0 0 35px rgba(245, 158, 11, 0.55)",
                  pointerEvents: "none",
                }}
                className="animate-pulse"
              >
                <span className="absolute -top-6 left-0 bg-[#F59E0B] text-[#0F172A] font-sans not-italic font-bold text-[11px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                  Source: {displayChunkId}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 relative w-full h-full flex items-center justify-center text-[#94A3B8] text-sm">
              Note image preview unavailable for Page {pageNum}.
            </div>
          )}
        </div>

        {/* Direct Quote / Passage Extracted from the Highlighted Note Box */}
        {matchedRegion?.text && (
          <div className="bg-[#1E293B]/80 border border-[#334155] rounded-xl p-3 text-xs sm:text-sm text-[#E2E8F0] flex flex-col gap-1">
            <span className="text-[#F59E0B] font-bold text-[11px] uppercase tracking-wider">
              Exact passage in your notes ({displayChunkId}):
            </span>
            <span className="italic leading-relaxed text-[#F8FAFC]">
              "{matchedRegion.text}"
            </span>
          </div>
        )}

        {/* Informative Subtext */}
        <div className="text-xs text-[#94A3B8] leading-relaxed shrink-0">
          The highlighted amber box indicates the exact handwritten note passage this question and answer were derived from.
        </div>

        {/* Bottom CTA Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="w-full sm:w-auto sm:min-w-[200px] h-12 sm:h-14 border-0 rounded-[16px] bg-[#818CF8] text-[#0F172A] text-sm sm:text-base font-bold hover:bg-[#A5B4FC] active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center shrink-0"
          >
            Back to quiz
          </button>
        </div>
      </div>
    </div>
  );
}
