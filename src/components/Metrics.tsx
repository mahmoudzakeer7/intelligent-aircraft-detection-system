/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldAlert, Users, Plane, Percent, Activity, Layers } from "lucide-react";
import { DetectionResult } from "../types";
import { translations } from "../translations";

interface MetricsProps {
  result: DetectionResult | null;
  totalScans: number;
  lang: "ar" | "en";
  theme: "dark" | "light";
}

export function Metrics({ result, totalScans, lang, theme }: MetricsProps) {
  const t = translations[lang];
  const list = result?.aircrafts || [];
  const total = list.length;
  const isLight = theme === "light";
  
  const militaryCount = list.filter(item => 
    item.aircraftType.toLowerCase().includes("military") || 
    item.aircraftType.includes("عسكري")
  ).length;

  const civilianCount = total - militaryCount;

  const averageConfidence = total > 0
    ? Math.round((list.reduce((acc, curr) => acc + curr.confidence, 0) / total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* CARD 1: TOTAL DETECTED */}
      <div className={`p-4 rounded-xl relative overflow-hidden group transition-all duration-300 ${
        isLight 
          ? "bg-white border border-slate-200/80 shadow-[0_4px_15px_rgba(148,163,184,0.05)] text-slate-800" 
          : "glass-card glass-card-interactive border-white/5 text-slate-100"
      }`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all duration-300"></div>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11.5px] text-slate-400 font-bold block uppercase tracking-wider">{t.totalDetectedObjects}</span>
            <span className="text-[10px] text-slate-500 uppercase font-mono block">{lang === "ar" ? "جرد الأجسام والمسار التكتيكي للرادار" : "TOTAL AIRCRAFT DETECTED"}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3.5xl font-black text-sky-500 dark:text-sky-400 font-mono tracking-tight">{total}</span>
              <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>{lang === "ar" ? "مركبات جوية" : "Aircraft"}</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border transition-colors ${
            isLight ? "bg-sky-500/5 border-sky-200 text-sky-600" : "bg-sky-500/10 border-sky-400/20 text-sky-400"
          }`}>
            <Plane className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          </div>
        </div>
        <div className={`mt-3 text-[10px] font-mono flex items-center justify-between border-t pt-2 ${
          isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400"
        }`}>
          <span>{t.totalScans}: {totalScans}</span>
          <span className="text-sky-500 dark:text-sky-400 font-medium">{t.scannersOnlineText}</span>
        </div>
      </div>

      {/* CARD 2: DETECTION ACCURACY */}
      <div className={`p-4 rounded-xl relative overflow-hidden group transition-all duration-300 ${
        isLight 
          ? "bg-white border border-slate-200/80 shadow-[0_4px_15px_rgba(148,163,184,0.05)] text-slate-800" 
          : "glass-card glass-card-interactive border-white/5 text-slate-100"
      }`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-300"></div>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11.5px] text-slate-400 font-bold block uppercase tracking-wider">{t.matchIndex}</span>
            <span className="text-[10px] text-slate-500 uppercase font-mono block">{t.accuracyLabel}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3.5xl font-black text-amber-500 dark:text-amber-400 font-mono tracking-tight">{averageConfidence}%</span>
              <span className={`text-xs font-bold uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>{t.accuracy}</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border transition-colors ${
            isLight ? "bg-amber-500/5 border-amber-200 text-amber-600" : "bg-amber-500/10 border-amber-400/20 text-amber-400"
          }`}>
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <div className={`mt-3 text-[10px] font-mono flex items-center justify-between border-t pt-2 ${
          isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400"
        }`}>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> {lang === "ar" ? "نظام المطابقة نشط" : "Active Matcher"}</span>
          <span className="text-amber-500 dark:text-amber-450 font-semibold">Gemini 3.5 Core</span>
        </div>
      </div>
    </div>
  );
}
