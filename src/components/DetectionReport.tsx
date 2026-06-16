import React, { useState } from "react";
import { Aircraft, DetectionResult } from "../types";
import {
  Globe, Cpu, Gauge, Navigation2, Users, Calendar,
  Shield, CheckCircle, XCircle, Crosshair, FileText, ChevronDown, ChevronUp
} from "lucide-react";

interface DetectionReportProps {
  aircrafts: Aircraft[];
  selectedIndex: number | null;
  onSelectIndex: (i: number) => void;
  detectionResult: DetectionResult | null;
  theme: "dark" | "light";
  /** Palette colors (border, bg, text, badge, dot) — one per detection */
  palette: PaletteEntry[];
}

export interface PaletteEntry {
  border: string;   // e.g. "border-rose-500"
  bg: string;       // e.g. "bg-rose-500/15"
  text: string;     // e.g. "text-rose-400"
  badge: string;    // e.g. "bg-rose-600"
  ring: string;     // e.g. "ring-rose-400"
  dot: string;      // e.g. "bg-rose-500"
}

/** Fixed palette of 8 vivid distinct colours for bounding boxes & report cards */
export const BOX_PALETTE: PaletteEntry[] = [
  { border: "border-rose-500",    bg: "bg-rose-500/15",    text: "text-rose-400",    badge: "bg-rose-700",    ring: "ring-rose-400",    dot: "bg-rose-500" },
  { border: "border-sky-400",     bg: "bg-sky-400/15",     text: "text-sky-400",     badge: "bg-sky-600",     ring: "ring-sky-400",     dot: "bg-sky-500" },
  { border: "border-amber-400",   bg: "bg-amber-400/15",   text: "text-amber-400",   badge: "bg-amber-600",   ring: "ring-amber-400",   dot: "bg-amber-500" },
  { border: "border-emerald-400", bg: "bg-emerald-400/15", text: "text-emerald-400", badge: "bg-emerald-700", ring: "ring-emerald-400", dot: "bg-emerald-500" },
  { border: "border-violet-400",  bg: "bg-violet-400/15",  text: "text-violet-400",  badge: "bg-violet-700",  ring: "ring-violet-400",  dot: "bg-violet-500" },
  { border: "border-pink-400",    bg: "bg-pink-400/15",    text: "text-pink-400",    badge: "bg-pink-700",    ring: "ring-pink-400",    dot: "bg-pink-500" },
  { border: "border-cyan-400",    bg: "bg-cyan-400/15",    text: "text-cyan-400",    badge: "bg-cyan-700",    ring: "ring-cyan-400",    dot: "bg-cyan-500" },
  { border: "border-orange-400",  bg: "bg-orange-400/15",  text: "text-orange-400",  badge: "bg-orange-700",  ring: "ring-orange-400",  dot: "bg-orange-500" },
];

/** Returns a palette entry by cycling through the fixed palette */
export function getPalette(index: number): PaletteEntry {
  return BOX_PALETTE[index % BOX_PALETTE.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SpecRow: React.FC<{ icon: React.ReactNode; label: string; value: string | number | null | undefined }> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sky-400 w-4 flex-shrink-0">{icon}</span>
      <span className="text-slate-400 text-[11px] w-28 flex-shrink-0">{label}</span>
      <span className="text-white text-[11px] font-semibold font-mono ml-auto text-right">{value}</span>
    </div>
  );
};

// ─── Single aircraft dossier (expanded) ──────────────────────────────────────
const AircraftDossier: React.FC<{ aircraft: Aircraft; color: PaletteEntry; index: number; isYolo: boolean }> = ({
  aircraft, color, index, isYolo,
}) => {
  const confPct = Math.round(aircraft.confidence * 100);
  return (
    <div className="mt-3 space-y-3 animate-fade-in" dir="ltr">
      {/* Description */}
      {aircraft.descriptionAr && (
        <div className="bg-slate-900/60 rounded-xl border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3 h-3 text-sky-400" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Intelligence Summary</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed">{aircraft.descriptionAr}</p>
        </div>
      )}

      {/* Specs */}
      {(aircraft.max_speed || aircraft.range || aircraft.crew || aircraft.first_flight) && (
        <div className="bg-slate-900/60 rounded-xl border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3 h-3 text-sky-400" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Technical Specifications</span>
          </div>
          <div className="divide-y divide-white/5">
            <SpecRow icon={<Gauge className="w-3 h-3" />}      label="Max Speed"    value={aircraft.max_speed} />
            <SpecRow icon={<Navigation2 className="w-3 h-3" />} label="Range"        value={aircraft.range} />
            <SpecRow icon={<Users className="w-3 h-3" />}       label="Crew"         value={aircraft.crew} />
            <SpecRow icon={<Calendar className="w-3 h-3" />}    label="First Flight" value={aircraft.first_flight} />
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {((aircraft.strengths && aircraft.strengths.length > 0) || (aircraft.weaknesses && aircraft.weaknesses.length > 0)) && (
        <div className="grid grid-cols-2 gap-2">
          {aircraft.strengths && aircraft.strengths.length > 0 && (
            <div className="bg-emerald-950/30 rounded-xl border border-emerald-500/20 p-2.5">
              <div className="flex items-center gap-1 mb-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase">Strengths</span>
              </div>
              <ul className="space-y-0.5">
                {aircraft.strengths.map((s, i) => (
                  <li key={i} className="text-[9px] text-emerald-300/80 flex items-start gap-1">
                    <span className="text-emerald-500 flex-shrink-0">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aircraft.weaknesses && aircraft.weaknesses.length > 0 && (
            <div className="bg-rose-950/30 rounded-xl border border-rose-500/20 p-2.5">
              <div className="flex items-center gap-1 mb-1.5">
                <XCircle className="w-3 h-3 text-rose-400" />
                <span className="text-[9px] font-bold text-rose-400 uppercase">Weaknesses</span>
              </div>
              <ul className="space-y-0.5">
                {aircraft.weaknesses.map((w, i) => (
                  <li key={i} className="text-[9px] text-rose-300/80 flex items-start gap-1">
                    <span className="text-rose-500 flex-shrink-0">✗</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* BBox Telemetry */}
      <div className="bg-slate-950/70 rounded-xl border border-white/5 p-2.5">
        <div className="flex items-center gap-1 mb-1.5">
          <Shield className="w-3 h-3 text-slate-400" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Bounding Box</span>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[9px] font-mono">
          <span className="text-slate-500">xmin <strong className={`ml-1 ${color.text}`}>{aircraft.xmin}</strong></span>
          <span className="text-slate-500">ymin <strong className={`ml-1 ${color.text}`}>{aircraft.ymin}</strong></span>
          <span className="text-slate-500">conf <strong className="ml-1 text-emerald-400">{confPct}%</strong></span>
          <span className="text-slate-500">xmax <strong className={`ml-1 ${color.text}`}>{aircraft.xmax}</strong></span>
          <span className="text-slate-500">ymax <strong className={`ml-1 ${color.text}`}>{aircraft.ymax}</strong></span>
          {aircraft.classId !== undefined &&
            <span className="text-slate-500">cls <strong className="ml-1 text-amber-400">{aircraft.classId}</strong></span>}
        </div>
      </div>
    </div>
  );
};

// ─── Main exported component ──────────────────────────────────────────────────
export const DetectionReport: React.FC<DetectionReportProps> = ({
  aircrafts,
  selectedIndex,
  onSelectIndex,
  detectionResult,
  theme,
  palette,
}) => {
  const isYolo = detectionResult?.detectionSource === "yolo";

  if (!aircrafts || aircrafts.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
        <Crosshair className="w-10 h-10 text-slate-600 opacity-30" />
        <p className="text-slate-500 text-xs font-semibold">No objects detected yet</p>
        <p className="text-slate-600 text-[10px]">Upload an image or video to begin detection</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" dir="ltr">
      {/* Summary bar */}
      {detectionResult?.summaryAr && (
        <div className="bg-sky-500/5 p-2.5 rounded-xl border border-sky-400/20 text-[10px] text-sky-200 mb-3">
          <span className="font-extrabold text-sky-400 block mb-0.5">▶ Airspace Summary</span>
          {detectionResult.summaryAr}
        </div>
      )}

      {/* One card per detected object */}
      {aircrafts.map((aircraft, i) => {
        const color = palette[i] || getPalette(i);
        const isSelected = selectedIndex === i;
        const confPct = Math.round(aircraft.confidence * 100);

        return (
          <div
            key={i}
            className={`rounded-xl border-2 transition-all duration-200 cursor-pointer overflow-hidden ${color.border} ${
              isSelected
                ? `${color.bg} shadow-lg ring-1 ${color.ring}`
                : "bg-slate-900/40 opacity-80 hover:opacity-100"
            }`}
            onClick={() => onSelectIndex(i)}
          >
            {/* Card header — always visible */}
            <div className="flex items-center gap-3 p-3">
              {/* Color dot + number */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${color.dot} text-white text-[10px] font-black shadow-md`}>
                {i + 1}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-white truncate">{aircraft.aircraftName}</span>
                  {isYolo && aircraft.rawClass && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                      🤖 {aircraft.rawClass}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] font-bold uppercase ${color.text}`}>{aircraft.aircraftType}</span>
                  {aircraft.country && (
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" />{aircraft.country}
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence + expand icon */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-black font-mono ${color.text}`}>{confPct}%</span>
                {isSelected
                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
              </div>
            </div>

            {/* Confidence bar */}
            <div className="h-0.5 bg-slate-800 mx-3 mb-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color.dot} transition-all duration-500`}
                style={{ width: `${confPct}%` }}
              />
            </div>

            {/* Expanded dossier */}
            {isSelected && (
              <div className="px-3 pb-3">
                <AircraftDossier
                  aircraft={aircraft}
                  color={color}
                  index={i}
                  isYolo={isYolo}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
