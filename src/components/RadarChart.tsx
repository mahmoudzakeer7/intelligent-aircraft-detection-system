/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Activity, ShieldAlert, Cpu } from "lucide-react";

export function RadarChart() {
  const [points, setPoints] = useState<number[]>([40, 60, 45, 80, 55, 75, 40, 90, 60, 45, 65, 80, 50, 70, 85, 40, 60]);
  const [scanX, setScanX] = useState<number>(0);

  // Generate real-time fluctuating signal points to emulate incoming radar signatures
  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const next = [...prev.slice(1)];
        // Fluctuating value centered around prior index for smooth visual waves
        const last = prev[prev.length - 1];
        const nextVal = Math.max(10, Math.min(95, last + (Math.random() * 30 - 15)));
        next.push(Math.round(nextVal));
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Animate the vertical green scan line crossing the chart
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      setScanX((prev) => (prev >= 100 ? 0 : prev + 0.3));
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Compute SVG Polyline points
  const svgWidth = 500;
  const svgHeight = 120;
  
  const formattedPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * svgWidth;
      const y = svgHeight - (val / 100) * svgHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="glass-card p-4 rounded-2xl border border-sky-500/10 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Radar Frequency Analyzer</h4>
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Radar Spectrum Frequency</span>
          </div>
        </div>
        <div className="text-right flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-400/20 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
          <Cpu className="w-3 h-3 animate-pulse" />
          <span>FREQ: 3.42 GHz</span>
        </div>
      </div>

      {/* SVG Canvas depicting live trace */}
      <div className="relative bg-slate-950/80 p-2 rounded-xl border border-white/5 overflow-hidden font-mono text-[9px] aspect-[4/1] flex items-center justify-center">
        {/* Radar Scanner Grid Lines Overlay */}
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-4 pointer-events-none opacity-15">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="border-t border-l border-sky-400"></div>
          ))}
        </div>

        {/* Live Scan Line */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.8)] pointer-events-none z-10"
          style={{ left: `${scanX}%` }}
        ></div>

        {/* Dynamic Vector Polyline */}
        <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Filled Area beneath line */}
          <path
            d={`M 0,${svgHeight} L ${formattedPoints} L ${svgWidth},${svgHeight} Z`}
            fill="url(#chartGlow)"
          />

          {/* Trace Line */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={formattedPoints}
            className="filter drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
          />

          {/* Individual high points circles */}
          {points.map((val, idx) => {
            if (val > 75) {
              const x = (idx / (points.length - 1)) * svgWidth;
              const y = svgHeight - (val / 100) * svgHeight;
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r="4" fill="#ef4444" className="animate-ping" />
                  <circle cx={x} cy={y} r="2.5" fill="#ef4444" />
                </g>
              );
            }
            return null;
          })}
        </svg>

        {/* Altitude Marker Overlay labels */}
        <span className="absolute top-1 left-2 text-[8px] text-slate-500">MAX FLIGHT CEILING: 45,000 FT</span>
        <span className="absolute bottom-1 right-2 text-[8px] text-slate-500">PING SWEEP CHANNELS: ACTIVE</span>
      </div>

      <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-2 border-t border-white/5 pt-2">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          STATUS: EXCELLENT / NORMAL
        </span>
        <span className="text-slate-500">DATA UPDATED: ISO-6</span>
      </div>
    </div>
  );
}
