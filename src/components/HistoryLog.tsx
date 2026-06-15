/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { History, Shield, Plane, ChevronLeft, Trash2, Eye } from "lucide-react";
import { RadarLog } from "../types";
import { translations } from "../translations";

interface HistoryLogProps {
  logs: RadarLog[];
  activeLogId: string | null;
  onSelectLog: (log: RadarLog) => void;
  onClearLogs: () => void;
  lang: "ar" | "en";
  theme: "dark" | "light";
}

export function HistoryLog({ logs, activeLogId, onSelectLog, onClearLogs, lang, theme }: HistoryLogProps) {
  const t = translations[lang];
  const isLight = theme === "light";

  return (
    <div className={`p-4 rounded-xl flex flex-col h-full border transition-all duration-300 ${
      isLight 
        ? "bg-white border-slate-200/80 shadow-[0_4px_15px_rgba(148,163,184,0.05)] text-slate-800" 
        : "glass-card border-sky-500/10 text-slate-100"
    }`} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className={`flex items-center justify-between border-b pb-2 mb-3 ${isLight ? "border-slate-100" : "border-white/5"}`}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-sky-500" />
          <div className="text-right">
            <h4 className={`text-xs font-bold uppercase tracking-wide ${isLight ? "text-slate-800" : "text-slate-200"}`}>{t.detectionLedger}</h4>
            <span className="text-[10px] text-slate-400 block uppercase font-mono">{t.airspaceDossier}</span>
          </div>
        </div>
        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-[9px] font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded uppercase tracking-wider"
          >
            <Trash2 className="w-2.5 h-2.5" />
            {t.clearAll}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[190px] space-y-2 pr-1">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center text-slate-400 px-2">
            <History className="w-8 h-8 opacity-25 mb-2 stroke-[1.5] text-sky-500" />
            <p className="text-xs font-semibold uppercase tracking-wider">{t.noLogsFound}</p>
            <p className="text-[10px] opacity-70 mt-1">{t.logInstructions}</p>
          </div>
        ) : (
          logs.map((log) => {
            const isActive = activeLogId === log.id;
            const highestThreat = log.result?.aircrafts.some(
              (a) => a.aircraftType === "Military" || a.aircraftType.includes("عسكري")
            );

            return (
              <div
                key={log.id}
                onClick={() => onSelectLog(log)}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between gap-3 group transition-all duration-200 ${
                  isActive
                    ? "bg-sky-500/10 border-sky-400/40 text-sky-600 dark:text-white"
                    : isLight 
                      ? "bg-slate-50 border-slate-200 hover:border-sky-350 text-slate-700" 
                      : "bg-slate-900/60 border-white/5 hover:border-sky-500/20 text-slate-300"
                }`}
              >
                {/* Left side actions and status */}
                <div className={`flex items-center gap-2 font-mono text-[10px] ${lang === "ar" ? "flex-row-reverse" : ""}`}>
                  <span className="text-slate-450 text-[9px]">{log.timestamp}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        log.status === "completed" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    ></span>
                  </div>
                </div>

                {/* Right side diagnostics */}
                <div className={`flex items-center gap-2.5 ${lang === "ar" ? "flex-row-reverse" : ""}`}>
                  <div className="text-right">
                    <p className={`text-xs font-bold truncate max-w-[120px] group-hover:text-sky-500 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                      {log.fileName}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[10px] text-slate-400">
                      <span>{log.aircraftDetected} {lang === "ar"?"مرصود":"Detected"}</span>
                      <Plane className="w-3 h-3 text-sky-400" />
                      {highestThreat && (
                        <span className="bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest">
                          {t.milGrade}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      isActive
                        ? "bg-sky-500/20 border-sky-400/30 text-sky-500"
                        : isLight 
                          ? "bg-white border-slate-200 text-slate-400 group-hover:text-slate-600" 
                          : "bg-slate-950 border-white/5 text-slate-500 group-hover:text-slate-300"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`mt-2 pt-2 border-t text-[9px] font-mono text-slate-400 flex justify-between ${isLight ? "border-slate-100" : "border-white/5"}`}>
        <span>{lang === "ar" ? "سعة الأرشيف: ٥٠ خلباً" : "History capacity: 50 items"}</span>
        <span>{lang === "ar" ? "تزامن محلي مؤمن" : "Secure Local Sync"}</span>
      </div>
    </div>
  );
}
