import React from "react";
import { Aircraft, DetectionResult } from "../types";
import {
  Globe, Cpu, Gauge, Navigation2, Users, Calendar,
  Shield, AlertTriangle, CheckCircle, XCircle, Eye, Crosshair, Zap, FileText
} from "lucide-react";

interface DetectionReportProps {
  aircraft: Aircraft | null;
  index: number | null;
  totalDetected: number;
  detectionResult: DetectionResult | null;
  theme: "dark" | "light";
}

// Map aircraft category string to a colour set
function typeColor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("military") || t.includes("attack") || t.includes("fighter") || t.includes("bomber"))
    return { border: "border-rose-500/60", bg: "bg-rose-500/10", text: "text-rose-400", badge: "bg-rose-600" };
  if (t.includes("drone") || t.includes("uav"))
    return { border: "border-amber-500/60", bg: "bg-amber-500/10", text: "text-amber-400", badge: "bg-amber-600" };
  if (t.includes("helicopter"))
    return { border: "border-purple-500/60", bg: "bg-purple-500/10", text: "text-purple-400", badge: "bg-purple-600" };
  if (t.includes("cargo") || t.includes("transport"))
    return { border: "border-sky-500/60", bg: "bg-sky-500/10", text: "text-sky-400", badge: "bg-sky-600" };
  return { border: "border-emerald-500/60", bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "bg-emerald-600" };
}

const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "bg-slate-800 text-slate-300 border-white/10" }) => (
  <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${color} whitespace-nowrap`}>
    {children}
  </span>
);

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

export const DetectionReport: React.FC<DetectionReportProps> = ({
  aircraft,
  index,
  totalDetected,
  detectionResult,
  theme,
}) => {
  const isYolo = detectionResult?.detectionSource === "yolo";

  if (!aircraft || index === null) {
    return (
      <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
        <Crosshair className="w-10 h-10 text-slate-600 opacity-40" />
        <p className="text-slate-500 text-xs font-semibold">Click a bounding box or list item to view full intelligence report</p>
        {totalDetected > 0 && (
          <p className="text-slate-600 text-[10px]">{totalDetected} object{totalDetected !== 1 ? "s" : ""} detected — select one above</p>
        )}
      </div>
    );
  }

  const colors = typeColor(aircraft.aircraftType);
  const confPct = Math.round(aircraft.confidence * 100);

  return (
    <div className="space-y-4 animate-fade-in" dir="ltr">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${colors.badge} text-white`}>
                {aircraft.aircraftType}
              </span>
              {isYolo && aircraft.rawClass && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                  🤖 YOLO: {aircraft.rawClass}
                </span>
              )}
              {aircraft.classId !== undefined && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-400 font-mono">
                  class_id: {aircraft.classId}
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-white leading-tight">{aircraft.aircraftName}</h3>
            {aircraft.country && (
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Globe className="w-3 h-3" /> {aircraft.country}
                {aircraft.manufacturer && <span className="text-slate-600 mx-1">•</span>}
                {aircraft.manufacturer && <span>{aircraft.manufacturer}</span>}
              </p>
            )}
          </div>

          {/* Confidence ring */}
          <div className="flex-shrink-0 text-center">
            <div className={`w-14 h-14 rounded-full border-4 ${colors.border} flex items-center justify-center bg-slate-950/60`}>
              <span className={`text-sm font-black ${colors.text}`}>{confPct}%</span>
            </div>
            <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase">Confidence</p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              confPct >= 85 ? "bg-emerald-400" : confPct >= 60 ? "bg-amber-400" : "bg-rose-400"
            }`}
            style={{ width: `${confPct}%` }}
          />
        </div>
      </div>

      {/* ── Description ────────────────────────────────────────────────────── */}
      {aircraft.descriptionAr && (
        <div className="bg-slate-900/60 rounded-xl border border-white/5 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Intelligence Summary</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{aircraft.descriptionAr}</p>
        </div>
      )}

      {/* ── Specifications Grid ─────────────────────────────────────────────── */}
      {(aircraft.max_speed || aircraft.range || aircraft.crew || aircraft.first_flight) && (
        <div className="bg-slate-900/60 rounded-xl border border-white/5 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technical Specifications</span>
          </div>
          <div className="divide-y divide-white/5">
            <SpecRow icon={<Gauge className="w-3.5 h-3.5" />}      label="Max Speed"   value={aircraft.max_speed} />
            <SpecRow icon={<Navigation2 className="w-3.5 h-3.5" />} label="Range"       value={aircraft.range} />
            <SpecRow icon={<Users className="w-3.5 h-3.5" />}       label="Crew"        value={aircraft.crew} />
            <SpecRow icon={<Calendar className="w-3.5 h-3.5" />}    label="First Flight" value={aircraft.first_flight} />
          </div>
        </div>
      )}


      {/* ── Strengths & Weaknesses ─────────────────────────────────────────── */}
      {((aircraft.strengths && aircraft.strengths.length > 0) || (aircraft.weaknesses && aircraft.weaknesses.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {aircraft.strengths && aircraft.strengths.length > 0 && (
            <div className="bg-emerald-950/30 rounded-xl border border-emerald-500/20 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Strengths</span>
              </div>
              <ul className="space-y-1">
                {aircraft.strengths.map((s, i) => (
                  <li key={i} className="text-[10px] text-emerald-300/80 flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aircraft.weaknesses && aircraft.weaknesses.length > 0 && (
            <div className="bg-rose-950/30 rounded-xl border border-rose-500/20 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Weaknesses</span>
              </div>
              <ul className="space-y-1">
                {aircraft.weaknesses.map((w, i) => (
                  <li key={i} className="text-[10px] text-rose-300/80 flex items-start gap-1.5">
                    <span className="text-rose-500 mt-0.5 flex-shrink-0">✗</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Bounding Box Telemetry ─────────────────────────────────────────── */}
      <div className="bg-slate-950/70 rounded-xl border border-white/5 p-3" dir="ltr">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bounding Box Telemetry</span>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] font-mono">
          <span className="text-slate-500">xmin <strong className="text-sky-300 ml-1">{aircraft.xmin}</strong></span>
          <span className="text-slate-500">ymin <strong className="text-sky-300 ml-1">{aircraft.ymin}</strong></span>
          <span className="text-slate-500">conf <strong className="text-emerald-400 ml-1">{confPct}%</strong></span>
          <span className="text-slate-500">xmax <strong className="text-sky-300 ml-1">{aircraft.xmax}</strong></span>
          <span className="text-slate-500">ymax <strong className="text-sky-300 ml-1">{aircraft.ymax}</strong></span>
          {aircraft.classId !== undefined &&
            <span className="text-slate-500">cls_id <strong className="text-amber-400 ml-1">{aircraft.classId}</strong></span>}
        </div>
      </div>
    </div>
  );
};
