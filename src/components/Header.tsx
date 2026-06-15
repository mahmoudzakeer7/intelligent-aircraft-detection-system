/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, Radio, Compass, Clock, Activity, Settings2, Sun, Moon, Globe } from "lucide-react";
import { SystemMetrics } from "../types";
import { translations } from "../translations";
// @ts-ignore
import logoIcon from "../assets/images/app_icon_1781170351288.png";

interface HeaderProps {
  metrics: SystemMetrics;
  onRefreshMetrics: () => void;
  lang: "ar" | "en";
  setLang: (l: "ar" | "en") => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}

export function Header({ metrics, onRefreshMetrics, lang, setLang, theme, setTheme }: HeaderProps) {
  const [time, setTime] = useState<string>("");
  const t = translations[lang];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLight = theme === "light";

  return (
    <header className={`mb-6 p-5 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-5 border transition-all duration-300 ${
      isLight 
        ? "bg-white/95 border-slate-200/80 shadow-[0_4px_20px_rgba(148,163,184,0.1)] text-slate-800" 
        : "glass-card border-sky-500/10 text-slate-100"
    }`}>
      {/* Right Column: Title & Subtitle */}
      <div className="flex items-center gap-4 w-full xl:w-auto">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-sky-500/20 blur-md rounded-full animate-pulse"></div>
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border p-2 flex items-center justify-center relative z-10 transition-colors ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-sky-400/40"
          }`}>
            <img 
              src={logoIcon} 
              alt="RAA Vision Logo" 
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-xl animate-pulse" 
              referrerPolicy="no-referrer" 
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight font-sans ${
              isLight 
                ? "bg-gradient-to-r from-slate-900 to-sky-700 bg-clip-text text-transparent" 
                : "bg-gradient-to-r from-white via-sky-100 to-sky-400 bg-clip-text text-transparent"
            }`}>
              RAA Vision
            </h1>
            <span className="text-[10px] sm:text-xs bg-sky-500/10 border border-sky-400/20 text-sky-500 dark:text-sky-400 px-2.5 py-0.5 sm:py-1 rounded-full font-black uppercase tracking-wider">
              AI PRO
            </span>
          </div>
          <p className={`text-xs sm:text-[13px] md:text-[14px] font-extrabold tracking-wide mt-1 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
            {t.appTitle}
          </p>
          <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 font-mono block mt-0.5">{t.appSubTitle}</span>
        </div>
      </div>

      {/* Center Grid: Airspace Radar Telemetry - Restored to side-by-side as requested */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 rounded-xl border text-xs sm:text-sm font-mono w-full xl:w-auto transition-all ${
        isLight 
          ? "bg-slate-50 border-slate-200 text-slate-800" 
          : "bg-slate-950/80 border-white/5 text-slate-200"
      }`}>
        {/* Sector GPS */}
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${isLight ? "bg-slate-100/80" : "bg-slate-900/50"}`}>
          <Compass className="w-4 h-4 text-sky-500 dark:text-sky-400 animate-spin" style={{ animationDuration: "12s" }} />
          <div>
            <span className="text-[9.5px] text-slate-400 block uppercase font-bold tracking-wider">{t.gpsCoords}</span>
            <span className="text-sky-600 dark:text-sky-300 font-bold text-[11px] sm:text-xs">{metrics.gpsCoords}</span>
          </div>
        </div>

        {/* Signal Latency */}
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse transition-colors ${isLight ? "bg-slate-100/80" : "bg-slate-900/50"}`}>
          <Activity className="w-4 h-4 text-emerald-500" />
          <div>
            <span className="text-[9.5px] text-slate-400 block uppercase font-bold tracking-wider">{t.latency}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] sm:text-xs">{metrics.pingMs}ms</span>
          </div>
        </div>

        {/* System Clock */}
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${isLight ? "bg-slate-100/80" : "bg-slate-900/50"}`}>
          <Clock className="w-4 h-4 text-amber-500" />
          <div>
            <span className="text-[9.5px] text-slate-400 block uppercase font-bold tracking-wider">{t.clock}</span>
            <span className="text-amber-600 dark:text-amber-300 font-bold text-[11px] sm:text-xs">{time.split(" ")[1]}</span>
          </div>
        </div>

        {/* Threat Coeff */}
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${isLight ? "bg-slate-100/80" : "bg-slate-900/50"}`}>
          <Shield className="w-4 h-4 text-rose-500" />
          <div>
            <span className="text-[9.5px] text-slate-400 block uppercase font-bold tracking-wider">{t.threatCoeff}</span>
            <span className={`font-black text-[11px] sm:text-xs ${metrics.threatScore > 50 ? "text-rose-500 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400"}`}>
              {metrics.threatScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Left Column: Actions / Toggles & Alive Status */}
      <div className={`flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full xl:w-auto border-t pt-3 xl:pt-0 xl:border-0 ${isLight ? "border-slate-200" : "border-white/5"}`}>
        
        {/* Language Toggler */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              lang === "ar"
                ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-300"
                : isLight 
                  ? "bg-white border-slate-200 text-slate-600 hover:text-slate-900" 
                  : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
            }`}
            title="Switch Language / تغيير اللغة"
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>{lang === "en" ? "العربية (AR)" : "ENGLISH (EN)"}</span>
          </button>

          {/* Theme Toggler (Dark vs Light) */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
              isLight 
                ? "bg-white border-slate-200 text-amber-500 hover:bg-slate-50" 
                : "bg-slate-900 border-white/5 text-sky-400 hover:text-white"
            }`}
            title={isLight ? t.darkMode : t.lightMode}
          >
            {isLight ? <Moon className="w-4 h-4 fill-amber-500/10" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        {/* System Active Tag */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 rounded-full h-2 bg-emerald-500 status-active-pulse ring-2 ring-emerald-500/30 animate-pulse"></span>
              {t.activeSurveillance}
            </span>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider font-extrabold">{t.liveTracerOnline}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
