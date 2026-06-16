/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Upload, 
  Plane, 
  Video, 
  Image as ImageIcon, 
  ShieldAlert, 
  Cpu, 
  CheckCircle2, 
  Loader2, 
  HelpCircle, 
  Sparkles,
  Play,
  Pause,
  Maximize2,
  RefreshCw,
  Compass,
  FileSpreadsheet,
  AlertTriangle,
  Zap,
  Activity,
  Wifi,
  WifiOff,
  Brain,
  ScanLine,
  SkipForward,
  FileDown,
  Volume2,
} from "lucide-react";
import { generateDetectionPDF } from "./utils/generatePDF";
import { Header } from "./components/Header";
import { Metrics } from "./components/Metrics";
import { HistoryLog } from "./components/HistoryLog";
import { ThreatAssessment } from "./components/ThreatAssessment";
import { DetectionReport, BOX_PALETTE, getPalette } from "./components/DetectionReport";
import { Aircraft, DetectionResult, TabType, RadarLog, SystemMetrics, DetectionMode, YoloServiceStatus } from "./types";
import { translations } from "./translations";

// @ts-ignore
import emergencySirenSound from "./tithuh-warning-545568.mp3";

// Aircraft image presets — reliable public domain sources
const SAMPLE_PRESETS = [
  {
    id: "preset-1",
    label: "Tactical Jet Squadron",
    englishLabel: "Tactical Jet Squadron",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/F-16_June_2008.jpg/1280px-F-16_June_2008.jpg",
    summaryAr: "Tactical fighter squadron patrol successfully logged. Spotted three military F/A-18 aircraft maneuvering in tight, low-altitude formation.",
    aircrafts: [
      { ymin: 180, xmin: 150, ymax: 520, xmax: 480, aircraftName: "F/A-18 Super Hornet", aircraftType: "Military", confidence: 0.99, descriptionAr: "An all-weather supersonic carrier-capable multirole fighter, equipped with advanced twin engines, search radar grids, and tracking countermeasure pods." },
      { ymin: 300, xmin: 490, ymax: 610, xmax: 820, aircraftName: "F-16 Fighting Falcon", aircraftType: "Military", confidence: 0.96, descriptionAr: "Lightweight, highly maneuverable tactical fighter designed for aerial combat and high-G combat maneuvers." },
      { ymin: 450, xmin: 250, ymax: 780, xmax: 600, aircraftName: "F-15 Strike Eagle", aircraftType: "Military", confidence: 0.94, descriptionAr: "Dual-role fighter designed for long-range interdiction and deep penetration of enemy airspace targets." }
    ]
  },
  {
    id: "preset-2",
    label: "Riyadh Commercial Terminals",
    englishLabel: "Riyadh Commercial Terminals",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_air_force_F100.jpg/1280px-PNG_air_force_F100.jpg",
    summaryAr: "Commercial operations regular and secure on the north apron of King Khalid International Airport. No security anomalies detected.",
    aircrafts: [
      { ymin: 120, xmin: 50, ymax: 480, xmax: 620, aircraftName: "Boeing 777-300ER", aircraftType: "Civilian", confidence: 0.97, descriptionAr: "Wide-body, long-range commercial passenger aircraft engineered with high-bypass turbofans and spacious cabin configurations." },
      { ymin: 440, xmin: 410, ymax: 890, xmax: 950, aircraftName: "Airbus A350-900", aircraftType: "Civilian", confidence: 0.95, descriptionAr: "Next-generation twin-engine wide-body airliner featuring carbon-fiber reinforced structure for maximised range and fuel efficiency." }
    ]
  },
  {
    id: "preset-3",
    label: "Tactical Supply Runway",
    englishLabel: "Tactical Supply Runway",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/C-130_Hercules_2.jpg/1280px-C-130_Hercules_2.jpg",
    summaryAr: "Heavy logistic cargo aircraft in formation detected at the auxiliary runway, confirming secured transport and supply capabilities.",
    aircrafts: [
      { ymin: 250, xmin: 110, ymax: 680, xmax: 590, aircraftName: "C-130 Hercules", aircraftType: "Cargo", confidence: 0.91, descriptionAr: "Four-engine military turboprop transport aircraft capable of using unprepared runways for tactical supply and medical evacuations." },
      { ymin: 420, xmin: 550, ymax: 790, xmax: 920, aircraftName: "RQ-4 Global Hawk Drone", aircraftType: "Drone", confidence: 0.88, descriptionAr: "High-altitude, long-endurance unmanned aerial vehicle (UAV) designed for global intelligence and comprehensive map surveillances." }
    ]
  }
];

// Helper to convert uploaded File to Base64 format
function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      const base64 = result.substring(commaIdx + 1);
      const mimeType = file.type;
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
}

// Convert preset images to base64 by fetching locally
async function fetchImageToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      const base64 = result.substring(commaIdx + 1);
      const mimeType = blob.type || "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
}

// Extract a single video frame as base64 JPEG using a canvas
function extractVideoFrame(video: HTMLVideoElement, quality = 0.85): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl.substring(dataUrl.indexOf(",") + 1); // strip "data:image/jpeg;base64,"
  } catch {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("image");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // ── Detection Mode ──────────────────────────────────────────────────────────
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("yolo");
  const [yoloStatus, setYoloStatus] = useState<YoloServiceStatus>({ online: false });
  const [isCheckingYolo, setIsCheckingYolo] = useState(false);

  // Image Detection state variables
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("auto");

  // Hover & Bounding State
  const [hoveredAircraftIndex, setHoveredAircraftIndex] = useState<number | null>(null);
  const [selectedAircraftIndex, setSelectedAircraftIndex] = useState<number | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [minConfidence, setMinConfidence] = useState<number>(30);

  // Video Detection states
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedVideoFixture, setSelectedVideoFixture] = useState<string>("border");
  const [simulatedCounter, setSimulatedCounter] = useState<number>(14);
  const [videoTargets, setVideoTargets] = useState<any[]>([]);

  // Emergency Siren state
  const emergencySirenRef = useRef<HTMLAudioElement | null>(null);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);

  // Real YOLO video detection state
  const [yoloVideoDetecting, setYoloVideoDetecting] = useState(false);
  const [yoloVideoDetections, setYoloVideoDetections] = useState<Aircraft[]>([]);
  const [yoloFrameCount, setYoloFrameCount] = useState(0);
  const yoloVideoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Telemetry Dashboard status metrics
  const [metrics, setMetrics] = useState<SystemMetrics>({
    online: true,
    temperature: 42,
    pingMs: 34,
    scansPerformed: 6,
    threatScore: 78,
    gpsCoords: "24.7136° N, 46.6753° E" // Riyadh Center
  });

  // History buffer
  const [radarLogs, setRadarLogs] = useState<RadarLog[]>([]);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // ── Check YOLO service status on mount and on demand ─────────────────────
  const checkYoloStatus = useCallback(async () => {
    setIsCheckingYolo(true);
    try {
      const res = await fetch("/api/yolo-health", { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      setYoloStatus(data);
    } catch {
      setYoloStatus({ online: false, message: "Service unreachable" });
    } finally {
      setIsCheckingYolo(false);
    }
  }, []);

  useEffect(() => {
    checkYoloStatus();
    const interval = setInterval(checkYoloStatus, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [checkYoloStatus]);

  // Fluctuating system metrics automatically for cyber aesthetic realism
  useEffect(() => {
    const inter = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        temperature: Math.round(40 + Math.random() * 5),
        pingMs: Math.round(30 + Math.random() * 10),
        threatScore: detectionResult 
          ? Math.min(100, Math.max(10, Math.round(
              (detectionResult.aircrafts.filter(a => a.aircraftType.toLowerCase().includes("military") || a.aircraftType.includes("عسكري")).length / detectionResult.aircrafts.length) * 60 + 20
            )))
          : prev.threatScore
      }));
    }, 4000);
    return () => clearInterval(inter);
  }, [detectionResult]);

  // Video Simulated Surveillance Trackers loop (Gemini / simulated mode)
  useEffect(() => {
    let timer: any;
    if (activeTab === "video" && isPlaying && detectionMode !== "yolo") {
      timer = setInterval(() => {
        setSimulatedCounter((prev) => prev + (Math.random() > 0.6 ? 1 : 0));
        const names = ["Boeing 737-MAX", "F-35 interceptor", "C-17 Globemaster", "MQ-9 Reaper", "Gulfstream G650", "Su-57 Felon"];
        const types = ["Civilian", "Military", "Cargo", "Drone", "Private", "Military"];
        const chosenIdx = Math.floor(Math.random() * names.length);
        const newTarget = {
          id: `TRK-${Math.floor(100 + Math.random() * 900)}`,
          model: names[chosenIdx],
          type: types[chosenIdx],
          altitude: Math.round(12000 + Math.random() * 25000),
          speed: Math.round(280 + Math.random() * 650),
          bearing: Math.round(Math.random() * 360),
          ymin: 20 + Math.random() * 50,
          xmin: 20 + Math.random() * 50,
          width: 15 + Math.random() * 15,
          height: 10 + Math.random() * 15,
          ymax: 10 + Math.random() * 20,
          xmax: 15 + Math.random() * 25,
        };
        setVideoTargets((prev) => {
          const list = [newTarget, ...prev];
          return list.slice(0, 4);
        });
      }, 2500);
    } else if (detectionMode !== "yolo") {
      setVideoTargets([]);
    }
    return () => clearInterval(timer);
  }, [activeTab, isPlaying, videoSrc, detectionMode]);

  // ── YOLO video frame analysis loop ────────────────────────────────────────
  useEffect(() => {
    let isActive = true;

    if (activeTab === "video" && isPlaying && videoSrc && detectionMode === "yolo" && yoloStatus.online) {
      setYoloVideoDetecting(true);
      
      const processNextFrame = async () => {
        if (!isActive) return;
        
        const video = videoPlayerRef.current;
        if (video && !video.paused && !video.ended) {
          const frameBase64 = extractVideoFrame(video);
          if (frameBase64) {
            try {
              const res = await fetch("/api/yolo-detect-frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ frame: frameBase64, mimeType: "image/jpeg", confidence: 0.25 }),
              });
              
              if (res.ok && isActive) {
                const data: DetectionResult = await res.json();
                setYoloVideoDetections(data.aircrafts || []);
                setYoloFrameCount(prev => prev + 1);
                if (data.totalCount > 0) {
                  setSimulatedCounter(prev => prev + data.totalCount);
                }
              }
            } catch {
              // silent fail for network drops
            }
          }
        }
        
        // Loop immediately after receiving the result, with a tiny 50ms buffer 
        // to prevent overloading the browser/server. This yields ~10-15 FPS.
        if (isActive) {
          setTimeout(processNextFrame, 50);
        }
      };

      // Start the loop
      processNextFrame();

    } else {
      setYoloVideoDetecting(false);
      if (!isPlaying) setYoloVideoDetections([]);
    }

    return () => {
      isActive = false;
    };
  }, [activeTab, isPlaying, videoSrc, detectionMode, yoloStatus.online]);

  // ── Core image detection logic ─────────────────────────────────────────────
  const runDetection = async (base64: string, mimeType: string): Promise<DetectionResult> => {
    if (detectionMode === "yolo") {
      const res = await fetch("/api/yolo-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType, confidence: minConfidence / 100 }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.yoloOffline) {
          throw new Error("YOLO_OFFLINE");
        }
        throw new Error(err.error || "YOLO detection failed");
      }
      return res.json();
    } else {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      if (!res.ok) throw new Error("Gemini detection failed");
      return res.json();
    }
  };

  // Handle Preset Clicks
  const handleSelectPreset = async (preset: typeof SAMPLE_PRESETS[0]) => {
    setSelectedImage(preset.url);
    setSelectedAircraftIndex(0);
    setHoveredAircraftIndex(null);
    setAnalysisError(null);
    setIsAnalyzing(true);

    try {
      const newLogId = "log-preset-sub-" + Date.now();
      const currentUTC = new Date().toISOString().substring(11, 19);
      const base64Data = await fetchImageToBase64(preset.url);
      const backendResult = await runDetection(base64Data.base64, base64Data.mimeType);

      setDetectionResult(backendResult);
      setMetrics(prev => ({ ...prev, scansPerformed: prev.scansPerformed + 1 }));

      const newLogObj: RadarLog = {
        id: newLogId,
        timestamp: currentUTC,
        fileName: preset.englishLabel,
        status: "completed",
        aircraftDetected: backendResult.totalCount,
        result: backendResult,
        imageUrl: preset.url,
        detectionMode,
      };
      setRadarLogs(prev => [newLogObj, ...prev.filter(l => l.id !== "log-" + preset.id)]);
      setActiveLogId(newLogId);

    } catch (err: any) {
      if (err.message === "YOLO_OFFLINE") {
        setAnalysisError("YOLOv8 service is offline. Please start detect_service/start_service.bat, then try again.");
        setDetectionResult(null);
      } else {
        // Graceful degradation to preset static data
        const backupResult: DetectionResult = {
          totalCount: preset.aircrafts.length,
          summaryAr: preset.summaryAr,
          aircrafts: preset.aircrafts,
          detectionSource: "mock",
        };
        setDetectionResult(backupResult);
        const currentUTC = new Date().toISOString().substring(11, 19);
        const newLogObj: RadarLog = {
          id: "offline-" + preset.id + "-" + Date.now(),
          timestamp: currentUTC,
          fileName: preset.englishLabel,
          status: "completed",
          aircraftDetected: backupResult.totalCount,
          result: backupResult,
          imageUrl: preset.url,
        };
        setRadarLogs(prev => [newLogObj, ...prev]);
        setActiveLogId(newLogObj.id);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Upload Photo manually
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setSelectedImage(localUrl);
    setHoveredAircraftIndex(null);
    setSelectedAircraftIndex(null);
    setAnalysisError(null);
    setIsAnalyzing(true);

    try {
      const resultObj = await fileToBase64(file);
      const backendResult = await runDetection(resultObj.base64, resultObj.mimeType);

      setDetectionResult(backendResult);
      setMetrics(prev => ({ ...prev, scansPerformed: prev.scansPerformed + 1 }));

      const currentUTC = new Date().toISOString().substring(11, 19);
      const newLogId = "log-upload-" + Date.now();
      const newLogObj: RadarLog = {
        id: newLogId,
        timestamp: currentUTC,
        fileName: file.name,
        status: "completed",
        aircraftDetected: backendResult.totalCount,
        result: backendResult,
        imageUrl: localUrl,
        detectionMode,
      };
      setRadarLogs(prev => [newLogObj, ...prev]);
      setActiveLogId(newLogId);
      if (backendResult.aircrafts.length > 0) setSelectedAircraftIndex(0);

    } catch (err: any) {
      if (err.message === "YOLO_OFFLINE") {
        setAnalysisError("YOLOv8 service is offline. Start detect_service/start_service.bat and retry.");
      } else {
        setAnalysisError("Detection failed. Please try again or switch to Gemini AI mode.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Video feed setup
  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = URL.createObjectURL(file);
    setVideoSrc(path);
    setIsPlaying(true);
    setSimulatedCounter(0);
    setVideoTargets([]);
    setYoloVideoDetections([]);
    setYoloFrameCount(0);
    setTimeout(() => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.play().catch(e => console.log("Auto-play blocked"));
      }
    }, 200);
  };

  const toggleVideoPlayback = () => {
    if (videoPlayerRef.current) {
      if (isPlaying) {
        videoPlayerRef.current.pause();
      } else {
        videoPlayerRef.current.play().catch(e => console.log(e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Load from history log selection
  const handleSelectHistoryLog = (log: RadarLog) => {
    if (log.result && log.imageUrl) {
      setSelectedImage(log.imageUrl);
      setDetectionResult(log.result);
      setActiveLogId(log.id);
      setSelectedAircraftIndex(0);
      setHoveredAircraftIndex(null);
    }
  };

  const handleClearHistory = () => {
    setRadarLogs([]);
    setActiveLogId(null);
  };

  // Filter objects based on confidence slider
  const displayedAircrafts = detectionResult?.aircrafts.filter(
    (a) => a.confidence * 100 >= minConfidence
  ) || [];

  // ── PDF Download handlers ─────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!selectedImage || displayedAircrafts.length === 0) return;
    setIsPdfLoading(true);
    try {
      await generateDetectionPDF({
        imageSrc: selectedImage,
        videoFrame: null,
        detectionResult,
        mode: "image",
        gpsCoords: metrics.gpsCoords,
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleDownloadVideoPDF = async () => {
    const video = videoPlayerRef.current;
    if (!video || yoloVideoDetections.length === 0) return;
    setIsPdfLoading(true);
    try {
      // Capture current video frame to base64
      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameDataUrl = canvas.toDataURL("image/jpeg", 0.92);

      const videoResult = {
        totalCount: yoloVideoDetections.length,
        summaryAr: `Live video frame capture — ${yoloFrameCount} frames processed`,
        aircrafts: yoloVideoDetections,
        detectionSource: "yolo" as const,
      };
      await generateDetectionPDF({
        imageSrc: frameDataUrl,
        videoFrame: null,
        detectionResult: videoResult,
        mode: "video",
        gpsCoords: metrics.gpsCoords,
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handlePlayEmergencySiren = () => {
    try {
      if (isSirenPlaying) {
        // Stop playing
        if (emergencySirenRef.current) {
          emergencySirenRef.current.pause();
          emergencySirenRef.current.currentTime = 0;
        }
        setIsSirenPlaying(false);
      } else {
        // Start playing
        if (!emergencySirenRef.current) {
          emergencySirenRef.current = new Audio(emergencySirenSound);
          emergencySirenRef.current.volume = 0.6;
          emergencySirenRef.current.onended = () => setIsSirenPlaying(false);
        }
        emergencySirenRef.current.currentTime = 0;
        emergencySirenRef.current.play().catch(e => {
          console.warn("Audio play blocked", e);
          setIsSirenPlaying(false);
        });
        setIsSirenPlaying(true);
      }
    } catch (e) {
      console.warn("Failed to toggle emergency siren", e);
    }
  };

  const t = translations[lang];
  const isLight = theme === "light";

  const sourceColors: Record<string, string> = {
    yolo: "text-emerald-400 border-emerald-500/50 bg-emerald-500/10",
    gemini: "text-violet-400 border-violet-500/50 bg-violet-500/10",
    mock: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  };

  return (
    <div 
      className={`min-h-screen flex flex-col justify-between font-sans selection:bg-sky-500/30 relative transition-all duration-300 ${
        isLight ? "bg-[#f8fafc]/95 text-slate-800" : "text-slate-100"
      }`}
      style={{
        background: isLight 
          ? "radial-gradient(circle at center, rgb(255, 255, 255) 0%, rgb(241, 245, 249) 100%)"
          : `radial-gradient(circle at center, rgba(15, 23, 42, 0.45) 0%, rgba(5, 7, 18, 0.95) 100%), 
             url('https://i.postimg.cc/RFQCzXNP/breathtaking-aerobatic-jet-team-performs-precise-formation-flight-sunset-powerful-military-aircraft.webp') no-repeat center center fixed`,
        backgroundSize: "cover"
      }}
    >
      {/* Absolute dark overlay for CRT monitor atmosphere */}
      {!isLight && (
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] pointer-events-none z-0"></div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 z-10 relative">
        {/* HEADER SECTION */}
        <Header 
          metrics={metrics} 
          onRefreshMetrics={() => {}} 
          lang={lang} 
          setLang={setLang} 
          theme={theme} 
          setTheme={setTheme} 
        />

        {/* ── MODEL SELECTION BAR ─────────────────────────────────────────────── */}
        <div className={`mb-5 p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-300 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-white/8 shadow-xl"
        }`}>
          <div className="flex items-center gap-2.5">
            <Brain className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">Detection Engine:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* YOLO toggle */}
            <button
              onClick={() => setDetectionMode("yolo")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                detectionMode === "yolo"
                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-slate-900/50 border-white/5 text-slate-400 hover:text-white hover:border-emerald-500/30"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${detectionMode === "yolo" ? "text-emerald-400" : ""}`} />
              🤖 YOLOv8 Local Model
              {detectionMode === "yolo" && <span className="text-[9px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded">ACTIVE</span>}
            </button>

            {/* Gemini toggle */}
            <button
              onClick={() => setDetectionMode("gemini")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                detectionMode === "gemini"
                  ? "bg-violet-500/20 border-violet-500/60 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                  : "bg-slate-900/50 border-white/5 text-slate-400 hover:text-white hover:border-violet-500/30"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${detectionMode === "gemini" ? "text-violet-400" : ""}`} />
              ✨ Gemini AI
              {detectionMode === "gemini" && <span className="text-[9px] font-mono bg-violet-500/20 px-1.5 py-0.5 rounded">ACTIVE</span>}
            </button>

            {/* YOLO status indicator */}
            {detectionMode === "yolo" && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold ${
                yoloStatus.online
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}>
                {isCheckingYolo ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : yoloStatus.online ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {yoloStatus.online ? `SERVICE ONLINE` : "SERVICE OFFLINE"}
                <button
                  onClick={checkYoloStatus}
                  title="Recheck YOLO service"
                  className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Offline warning */}
            {detectionMode === "yolo" && !yoloStatus.online && (
              <span className="text-[10px] text-amber-400 font-mono">
                → Run: <code className="bg-slate-800 px-1.5 py-0.5 rounded">detect_service\start_service.bat</code>
              </span>
            )}
          </div>
        </div>

        {/* TOP STATUS COUNTERS GRID */}
        <Metrics result={detectionResult} totalScans={metrics.scansPerformed} lang={lang} theme={theme} />

        {/* TABS CONTROLLERS */}
        <div className={`flex justify-center gap-2 mb-6 max-w-xl mx-auto p-1.5 rounded-xl border relative shadow-xl transition-all duration-300 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900/95 border-white/5 shadow-2xl"
        }`}>
          <button
            onClick={() => setActiveTab("image")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "image"
                ? "bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-lg"
                : isLight ? "text-slate-500 hover:text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {t.imageAnalysis}
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "video"
                ? "bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-lg"
                : isLight ? "text-slate-500 hover:text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Video className="w-3.5 h-3.5 animate-pulse" />
            {t.liveRadarStream}
          </button>
          <button
            onClick={() => setActiveTab("threat")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "threat"
                ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg"
                : isLight ? "text-slate-550 hover:text-rose-600" : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
            {t.threatAssessment}
          </button>
        </div>

        {/* ======================= TAB 1: IMAGE DETECTION ======================= */}
        {activeTab === "image" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* COLUMN A: UPLOAD, SPEC CONTROLS & DETECTED INVENTORY (SPAN 3) */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              
              {/* Dropzone Container */}
              <div className="glass-card p-5 rounded-2xl flex flex-col border border-sky-500/10 justify-between">
                <div>
                  <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest pb-3 border-b border-white/5 mb-4 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 status-active-pulse"></span>
                    Upload Map / Image
                  </h3>
                  
                  {/* File Upload Trigger */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700/60 hover:border-sky-500/50 bg-slate-950/40 hover:bg-slate-950/70 p-5 rounded-xl text-center group cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[140px]"
                  >
                    <Upload className="w-10 h-10 text-slate-500 group-hover:text-sky-400 group-hover:scale-110 transition-all mb-2 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-300">Drop image or click to browse</p>
                    <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP (Up to 15MB)</p>
                    <p className={`text-[9px] mt-2 font-mono font-bold ${detectionMode === "yolo" ? "text-emerald-400" : "text-violet-400"}`}>
                      {detectionMode === "yolo" ? "🤖 Will use YOLOv8 model" : "✨ Will use Gemini AI"}
                    </p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleUploadImage} 
                    />
                  </div>

                  {/* Preset Quick Selectors */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">AI Radar Preset Feeds:</span>
                    {SAMPLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        disabled={isAnalyzing}
                        className="w-full text-right p-2.5 rounded-xl border border-white/5 bg-slate-900/40 hover:border-sky-500/20 hover:bg-slate-900 transition-all text-xs font-bold font-sans flex items-center justify-between group cursor-pointer disabled:opacity-50"
                      >
                        <Plane className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                        <div>
                          <span className="block text-slate-200">{preset.label}</span>
                          <span className="text-[9px] text-slate-400 block font-mono font-medium">{preset.englishLabel}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Slider block */}
                <div className="border-t border-white/5 pt-4 mt-4">
                  <div className="flex justify-between items-center text-xs font-bold mb-2">
                    <span className="text-slate-400">Confidence Threshold:</span>
                    <span className="text-sky-400 font-mono">{minConfidence}%</span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="90"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-full accent-sky-400 bg-slate-950 h-1 rounded-lg outline-none cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block text-center mt-1">Filter targets below radar confidence score</span>
                </div>
              </div>

              {/* Detailed Breakdown List */}
              <div className="glass-card p-4 rounded-xl flex flex-col border border-sky-500/10 h-[280px]">
                <h4 className="text-xs font-extrabold text-slate-200 mb-2 pb-2 border-b border-white/5 flex items-center justify-between">
                  <span>Classified Airspace Inventory</span>
                  <span className="text-[10px] font-mono font-medium text-slate-500">Monitored ({displayedAircrafts.length})</span>
                </h4>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 ml-1 text-right">
                  {displayedAircrafts.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center py-10">
                      No active airspace targets match current confidence filter.
                    </div>
                  ) : (
                    displayedAircrafts.map((obj, idx) => {
                      const isSelected = selectedAircraftIndex === idx;
                      const isMilitary = obj.aircraftType.toLowerCase().includes("military") || obj.aircraftType.includes("عسكري");
                      
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedAircraftIndex(idx)}
                          onMouseEnter={() => setHoveredAircraftIndex(idx)}
                          onMouseLeave={() => setHoveredAircraftIndex(null)}
                          className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-right flex items-center justify-between gap-2.5 ${
                            isSelected 
                              ? "bg-sky-500/10 border-sky-400/40 text-white" 
                              : "bg-slate-900/60 border-white/5 hover:border-slate-800 text-slate-300"
                          }`}
                        >
                          {/* Percent accuracy bar */}
                          <div className="flex flex-col gap-1 items-start w-16">
                            <span className="text-[10px] font-mono text-slate-400">Match: {Math.round(obj.confidence * 100)}%</span>
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className={`h-full rounded-full ${isMilitary ? "bg-rose-500" : "bg-sky-500"}`}
                                style={{ width: `${obj.confidence * 100}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Technical details text */}
                          <div className="text-right flex-1 min-w-0">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-slate-100 font-bold text-xs truncate">{obj.aircraftName}</span>
                              <span className="text-[10px] font-mono text-slate-500">[{idx + 1}]</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-1 font-mono text-[9px]">
                              <span>Class: {obj.aircraftType}</span>
                              {obj.rawClass && <span className="text-slate-600">({obj.rawClass})</span>}
                              <span className={`w-1.5 h-1.5 rounded-full ${isMilitary ? "bg-rose-500" : "bg-sky-400"}`}></span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* COLUMN B: MAIN DETECTION DISPLAY & VIEWER (SPAN 9 - WIDER AND GREATER HEIGHT) */}
            <div className="lg:col-span-9 flex flex-col gap-4">
              <div className="glass-card rounded-2xl flex flex-col border border-sky-500/10 overflow-hidden relative grow flex-1 min-h-[750px] w-full">
                {/* Visual Viewport Header bar */}
                <div className="bg-slate-950/90 py-2.5 px-4 border-b border-white/5 flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-sky-400 flex items-center gap-1.5 uppercase">
                    <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "20s" }} />
                    Active Tactical HUD Target Visualizer
                  </span>
                  <div className="flex items-center gap-3">
                    {detectionResult?.detectionSource && (
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${sourceColors[detectionResult.detectionSource] || sourceColors.mock}`}>
                        {detectionResult.detectionSource === "yolo" ? "🤖 YOLOv8 LOCAL" :
                         detectionResult.detectionSource === "gemini" ? "✨ GEMINI AI" : "📋 DEMO DATA"}
                      </span>
                    )}
                    <span className="text-slate-500">ZOOM: 100% SCALE</span>
                  </div>
                </div>

                {/* Visual canvas area */}
                <div className="flex-1 min-h-[620px] relative bg-slate-950/90 flex items-center justify-center overflow-x-hidden crt-scanlines w-full">
                  {isAnalyzing ? (
                    <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
                        <span className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-emerald-500 status-active-pulse"></span>
                      </div>
                      <div className="space-y-1 px-4">
                        <p className="text-xs font-bold text-sky-300 uppercase tracking-widest animate-pulse">
                          {detectionMode === "yolo" ? "🤖 Running YOLOv8 Neural Network..." : "✨ Scanning Airspace via Gemini AI..."}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {detectionMode === "yolo" ? "LOADING best.pt → RUNNING INFERENCE → PARSING BBOXES" : "PROBING SENSOR WAVEFORMS • RUNNING OBJECT EXTRACTION"}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {analysisError ? (
                    <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
                      <AlertTriangle className="w-12 h-12 text-rose-500 animate-bounce" />
                      <p className="text-sm font-bold text-slate-200">{analysisError}</p>
                      <div className="flex gap-2 flex-wrap justify-center">
                        <button 
                          onClick={() => { setAnalysisError(null); checkYoloStatus(); }}
                          className="px-4 py-2 bg-emerald-600/20 border border-emerald-400/30 text-emerald-300 text-xs rounded-xl font-bold cursor-pointer"
                        >
                          Recheck YOLO Service
                        </button>
                        <button 
                          onClick={() => { setDetectionMode("gemini"); setAnalysisError(null); }}
                          className="px-4 py-2 bg-violet-600/20 border border-violet-400/30 text-violet-300 text-xs rounded-xl font-bold cursor-pointer"
                        >
                          Switch to Gemini AI
                        </button>
                        <button 
                          onClick={() => handleSelectPreset(SAMPLE_PRESETS[0])}
                          className="px-4 py-2 bg-sky-600/20 border border-sky-400/30 text-sky-300 text-xs rounded-xl font-bold cursor-pointer"
                        >
                          Run Demo Preset
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectedImage ? (
                    /*
                      FIX: The outer div is purely a flex centering container (no 'relative').
                      The INNER div is 'inline-block relative' so it shrinks to exactly
                      the rendered image dimensions. All absolute-positioned bounding boxes
                      are children of the inner div, so their % coords map 1:1 to image pixels.
                    */
                    <div className="flex items-center justify-center w-full h-full p-2" dir="ltr">
                      {/* 
                        Use aspect-ratio with w-full and max-h-[70vh].
                        This ensures small images scale UP to fill the screen,
                        but keep their precise dimensions so bounding boxes map 1:1.
                      */}
                      <div 
                        className="relative mx-auto flex items-center justify-center w-full max-h-[70vh]" 
                        style={{ aspectRatio: imageAspectRatio, maxHeight: '70vh' }}
                      >
                        <img
                          src={selectedImage}
                          alt="Scanned Target"
                          className="absolute inset-0 w-full h-full object-contain rounded-lg border border-white/5 opacity-90 shadow-2xl"
                          onLoad={(e) => {
                            const { naturalWidth, naturalHeight } = e.currentTarget;
                            if (naturalWidth && naturalHeight) {
                              setImageAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                            }
                          }}
                          onError={(e) => {
                            // If preset image fails, clear and show upload prompt
                            const t = e.target as HTMLImageElement;
                            if (!t.src.startsWith("blob:")) {
                              setSelectedImage(null);
                            }
                          }}
                        />

                        {/* Bounding boxes — unique color per object index from the global palette */}
                        {!isAnalyzing && !analysisError && displayedAircrafts.map((box, i) => {
                          const isHovered = hoveredAircraftIndex === i;
                          const isSelected = selectedAircraftIndex === i;
                          const isYoloDet = detectionResult?.detectionSource === "yolo";
                          const pal = getPalette(i);

                          // 0–1000 coordinate scale → percentage of image
                          const top    = box.ymin / 10;
                          const left   = box.xmin / 10;
                          const width  = (box.xmax - box.xmin) / 10;
                          const height = (box.ymax - box.ymin) / 10;

                          return (
                            <div
                              key={i}
                              onMouseEnter={() => setHoveredAircraftIndex(i)}
                              onMouseLeave={() => setHoveredAircraftIndex(null)}
                              onClick={() => setSelectedAircraftIndex(i)}
                              className={`absolute border-2 rounded transition-all duration-200 cursor-pointer ${pal.border} ${pal.bg} ${
                                isHovered || isSelected
                                  ? `ring-2 ${pal.ring} shadow-lg z-30`
                                  : "z-20 opacity-85"
                              }`}
                              style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
                            >
                              {/* Corner reticles — use same palette color */}
                              <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${pal.border}`} />
                              <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${pal.border}`} />
                              <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${pal.border}`} />
                              <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${pal.border}`} />

                              {/* Label badge */}
                              <span className={`absolute -top-6 left-0 ${pal.badge} text-white font-mono font-bold text-[9px] py-0.5 px-2 rounded whitespace-nowrap z-40 shadow-md`}>
                                [{i + 1}] {box.rawClass || box.aircraftName} ({Math.round(box.confidence * 100)}%)
                                {isYoloDet && <span className="ml-1 opacity-70">🤖</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
                      <Plane className="w-16 h-16 opacity-15 stroke-[1.5]" />
                      <p className="text-xs font-bold">No Active Input for Viewport Rendering</p>
                      <p className="text-[10px] opacity-70">Click one of the quick selector AI presets or upload a local image to initiate radar classification.</p>
                    </div>
                  )}
                </div>

                {/* ── Full Intelligence Report Panel: ALL objects with their unique colours ── */}
                <div className="p-5 border-t border-white/5 bg-slate-950/45 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 status-active-pulse"></span>
                      Detection Report
                      {displayedAircrafts.length > 0 && (
                        <span className="text-[9px] font-mono bg-slate-800 border border-white/10 px-1.5 py-0.5 rounded text-slate-400 ml-1">
                          {displayedAircrafts.length} object{displayedAircrafts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </h4>
                    <span className="text-[9px] font-mono font-medium text-emerald-400 tracking-wider">SECURE TRANSMISSION TYPE-6</span>
                  </div>

                  <DetectionReport
                    aircrafts={displayedAircrafts}
                    selectedIndex={selectedAircraftIndex}
                    onSelectIndex={setSelectedAircraftIndex}
                    detectionResult={detectionResult}
                    theme={theme}
                    palette={BOX_PALETTE}
                  />

                  {/* PDF Download Button */}
                  {displayedAircrafts.length > 0 && selectedImage && (
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isPdfLoading}
                      className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-900/40 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-wait hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {isPdfLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF...</>
                      ) : (
                        <><FileDown className="w-4 h-4" />Download Detection Report (PDF)</>
                      )}
                    </button>
                  )}
                </div>

                {/* Sub info coordinates catalog */}
                <div className="bg-slate-950/80 p-3 border-t border-white/5 flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                  <span className="text-slate-500">Active Reticle Targets: {displayedAircrafts.length}</span>
                  <span className="text-slate-500">Coordinates: Auto-scaled 0..1000 %</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: VIDEO DETECTION ======================= */}
        {activeTab === "video" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" dir="ltr">
            {/* COLUMN A: SURVEILLANCE FEED CONTROLLER (SPAN 8) */}
            <div className="lg:col-span-8 flex flex-col gap-4" dir="rtl">
              <div className="glass-card p-4 rounded-2xl flex flex-col border border-sky-500/10 overflow-hidden relative grow flex-1 h-full min-h-[480px]">
                
                {/* Control bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 mb-4 gap-3 text-left" dir="ltr">
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <div className="text-left">
                      <h3 className="text-sm font-black text-slate-100">
                        {detectionMode === "yolo" ? "🤖 YOLOv8 Real-Time Video Analysis" : "Tactical Satellite Monitoring & Live Viewports"}
                      </h3>
                      <span className="text-[10.5px] text-slate-400 block uppercase font-mono tracking-wider">
                        {detectionMode === "yolo" && yoloStatus.online
                          ? `Live Frame Analysis — ${yoloFrameCount} frames processed`
                          : "Live Sat-Relay Stream"}
                      </span>
                    </div>
                  </div>

                  {/* Operational Stream Selectors (only in Gemini/sim mode) */}
                  {detectionMode !== "yolo" && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {[
                        { id: "border", label: "Border Scan", desc: "Border" },
                        { id: "terminal", label: "Runway Track", desc: "Runway" },
                        { id: "airforce", label: "Tactical Wing", desc: "Tactical Wing" }
                      ].map((fixtureVariant) => (
                        <button
                          key={fixtureVariant.id}
                          onClick={() => {
                            setSelectedVideoFixture(fixtureVariant.id);
                            setSimulatedCounter(20 + Math.floor(Math.random() * 20));
                            setVideoTargets([]);
                          }}
                          className={`px-3 py-1 bg-slate-900 border text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                            selectedVideoFixture === fixtureVariant.id
                              ? "border-sky-400 text-sky-400 bg-sky-500/10"
                              : "border-white/5 text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                        >
                          {fixtureVariant.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video Monitor / YOLO analysis canvas */}
                <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/10 flex items-center justify-center aspect-video min-h-[300px]">
                  
                  {videoSrc ? (
                    <div className="flex items-center justify-center w-full h-full bg-black p-2" dir="ltr">
                      {/*
                        Same aspect-ratio trick as the image viewer:
                        The wrapper matches the video's natural aspect ratio so bounding
                        box % coordinates map 1:1 to the actual video pixels.
                      */}
                      <div
                        className="relative mx-auto w-full"
                        style={{ aspectRatio: "16/9", maxHeight: "580px" }}
                      >
                        <video 
                          ref={videoPlayerRef}
                          src={videoSrc}
                          loop
                          onLoadedMetadata={(e) => {
                            const v = e.currentTarget;
                            if (v.videoWidth && v.videoHeight) {
                              // update the wrapper aspect-ratio to match actual video
                              (v.parentElement as HTMLElement).style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
                            }
                          }}
                          className="absolute inset-0 w-full h-full object-contain rounded-lg border border-white/5 opacity-90" 
                          onClick={toggleVideoPlayback}
                        />

                        {/* YOLO real bounding boxes on video — unique palette color per object index */}
                        {detectionMode === "yolo" && isPlaying && yoloVideoDetections.map((box, i) => {
                          const pal = getPalette(i);
                          return (
                            <div
                              key={i}
                              className={`absolute border-2 rounded ${pal.border} ${pal.bg} pointer-events-none z-20`}
                              style={{
                                top: `${box.ymin / 10}%`,
                                left: `${box.xmin / 10}%`,
                                width: `${(box.xmax - box.xmin) / 10}%`,
                                height: `${(box.ymax - box.ymin) / 10}%`,
                              }}
                            >
                              <span className={`absolute -top-5 left-0 ${pal.badge} text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded whitespace-nowrap`}>
                                [{i+1}] {box.rawClass || box.aircraftName} {Math.round(box.confidence * 100)}%
                              </span>
                              <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${pal.border}`}></div>
                              <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${pal.border}`}></div>
                              <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${pal.border}`}></div>
                              <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${pal.border}`}></div>
                            </div>
                          );
                        })}

                        {/* YOLO processing indicator */}
                        {detectionMode === "yolo" && yoloVideoDetecting && (
                          <div className="absolute top-3 right-3 bg-emerald-900/90 border border-emerald-500/50 px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] font-mono text-emerald-300 z-30 shadow-md">
                            <ScanLine className="w-3 h-3 animate-pulse" />
                            YOLOv8 LIVE
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Futuristic Cybernetic Radar Sweep Simulation Grid
                    <div 
                      className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group"
                      onClick={() => {
                        setVideoTargets([]);
                        setIsPlaying(!isPlaying);
                      }}
                    >
                      {/* Grid overlays */}
                      <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-30 pointer-events-none">
                        {Array.from({ length: 72 }).map((_, i) => (
                          <div key={i} className="border-t border-l border-sky-400/40"></div>
                        ))}
                      </div>

                      {/* Continuous concentric radar circle overlays */}
                      <div className="absolute w-[2400px] h-[2400px] border border-emerald-500/10 rounded-full flex items-center justify-center animate-pulse z-0">
                        <div className="w-[1800px] h-[1800px] border border-emerald-500/10 rounded-full flex items-center justify-center">
                          <div className="w-[1200px] h-[1200px] border border-emerald-500/15 rounded-full flex items-center justify-center">
                            <div className="w-[800px] h-[800px] border border-emerald-500/20 rounded-full flex items-center justify-center">
                              <div className="w-[400px] h-[400px] border border-emerald-500/25 rounded-full flex items-center justify-center">
                                <Compass className="w-16 h-16 text-emerald-400 opacity-20 animate-spin" style={{ animationDuration: "35s" }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Moving vector radar sweep beam */}
                      {isPlaying && (
                        <div className="absolute inset-0 pointer-events-none z-10 origin-center loader-sweep" style={{ background: "conic-gradient(from 0deg at 50% 50%, rgba(16,185,129,0.1) 0deg, rgba(16,185,129,0) 90deg)" }}></div>
                      )}

                      {/* Simulated HUD Target markers (Gemini/sim mode only) */}
                      {isPlaying && detectionMode !== "yolo" && videoTargets.map((tracker, i) => (
                        <div
                          key={tracker.id}
                          className="absolute border-2 border-emerald-400 bg-emerald-500/15 rounded-xl p-1.5 flex flex-col justify-between select-none shadow-[0_0_12px_rgba(52,211,153,0.6)] pointer-events-none z-20 animate-pulse"
                          style={{
                            top: `${tracker.ymin}%`,
                            left: `${tracker.xmin}%`,
                            width: `${tracker.width + 5}%`,
                            height: `${tracker.height + 5}%`
                          }}
                        >
                          <div className="text-[10px] bg-slate-950/95 text-emerald-350 px-2 py-1 rounded-md font-mono border border-emerald-400/30 whitespace-nowrap overflow-hidden font-bold leading-normal">
                            #{tracker.id} | MODEL: {tracker.model}
                            <br />ALT: {tracker.altitude.toLocaleString()} FT | SPD: {tracker.speed} KT
                          </div>
                          <div className="absolute inset-x-2 inset-y-2 border border-dashed border-emerald-400/40"></div>
                        </div>
                      ))}

                      {/* Display center prompt */}
                      <div className="z-10 text-center space-y-4 max-w-sm px-4 bg-slate-950/90 p-6 rounded-2xl border border-white/5 backdrop-blur-md">
                        <Play className={`w-12 h-12 text-sky-400 mx-auto ${isPlaying ? "animate-ping" : "group-hover:scale-110 transition-transform"}`} />
                        <div>
                          <p className="text-xs font-black text-slate-100">
                            {isPlaying ? "Tactical Military Radar Simulator Active" : "Upload a video for real YOLO detection"}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            {detectionMode === "yolo"
                              ? "Upload a video file and YOLOv8 will analyze each frame in real-time, drawing bounding boxes around detected aircraft."
                              : "This simulator injects live wave signals to periodically log and categorize arbitrary aircraft models."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tactical Bottom status overlay inside viewport */}
                  <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-3 text-xs font-mono select-none z-20">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400">FPS: 60.0</span>
                    <span className="text-slate-400">RESOLUTION: UHD 4K LAYER</span>
                  </div>
                </div>

                {/* Primary Media Control panel at bottom */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/70 p-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleVideoPlayback}
                      className="p-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-full cursor-pointer transition-transform hover:scale-105"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <div>
                      <p className="text-xs font-bold text-slate-100">
                        {videoSrc ? "Custom video payload loaded successfully" : "Free Airspace Surveillance Simulator"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {detectionMode === "yolo" && yoloStatus.online
                          ? `🤖 YOLOv8 analyzing frames every 2s • ${yoloFrameCount} frames processed`
                          : isPlaying ? "Automated tracking core traces spatial transformations" : "Radar scanning temporarily paused"}
                      </p>
                    </div>
                  </div>

                  {/* Manual video upload controls */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-extrabold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Video (MP4)
                      {detectionMode === "yolo" && <span className="text-emerald-400 text-[9px]">→ YOLO</span>}
                    </button>
                    <input 
                      type="file" 
                      ref={videoInputRef} 
                      className="hidden" 
                      accept="video/*" 
                      onChange={handleUploadVideo} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN B: TRACKED TARGET STATS SIDEBAR (SPAN 4) */}
            <div className="lg:col-span-4 flex flex-col gap-4" dir="rtl">
              
              {/* Core live counters */}
              <div className={`glass-card p-5 rounded-2xl flex items-center justify-center gap-3 border-2 animate-pulse text-center shadow-[0_0_15px_rgba(244,63,94,0.35)] ${
                detectionMode === "yolo" && yoloStatus.online
                  ? "border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "border-rose-500/50 bg-rose-950/20"
              }`}>
                <span className={`w-3.5 h-3.5 rounded-full status-active-pulse ring-4 animate-pulse ${
                  detectionMode === "yolo" && yoloStatus.online ? "bg-emerald-500 ring-emerald-500/30" : "bg-rose-500 ring-rose-500/30"
                }`}></span>
                <span className={`text-sm uppercase font-black tracking-widest ${
                  detectionMode === "yolo" && yoloStatus.online ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {detectionMode === "yolo" && yoloStatus.online ? "🤖 YOLO LIVE ANALYSIS" : "LIVE HUD TARGETING RADAR ACTIVE"}
                </span>
              </div>

              {/* YOLO current frame detections — with palette colors matching the bounding boxes */}
              {detectionMode === "yolo" && videoSrc && (
                <div className="glass-card p-4 rounded-2xl border border-white/8 bg-slate-900/60 flex-1">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Live Detection Report
                  </h4>
                  <DetectionReport
                    aircrafts={yoloVideoDetections}
                    selectedIndex={selectedAircraftIndex}
                    onSelectIndex={setSelectedAircraftIndex}
                    detectionResult={yoloVideoDetections.length > 0 ? { totalCount: yoloVideoDetections.length, summaryAr: "", aircrafts: yoloVideoDetections, detectionSource: "yolo" } : null}
                    theme={theme}
                    palette={BOX_PALETTE}
                  />

                  {/* PDF download for video frame */}
                  {yoloVideoDetections.length > 0 && (
                    <button
                      onClick={handleDownloadVideoPDF}
                      disabled={isPdfLoading}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-900/40 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-wait hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {isPdfLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF...</>
                      ) : (
                        <><FileDown className="w-4 h-4" />Download Frame Report (PDF)</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Amplify Emergency Satellite Siren */}
              <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>Sound Effect by <a href="#" className="underline">freesound_community</a> from <a href="#" className="underline">Pixabay</a></span>
                  <span className="flex items-center gap-1"><Volume2 className="w-3 h-3 text-rose-500" /> :مصدر الصوت</span>
                </div>
                
                <button
                  onClick={handlePlayEmergencySiren}
                  className={`w-full py-4 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group ${
                    isSirenPlaying 
                      ? "bg-rose-500/20 border-rose-500/80 hover:bg-rose-500/30 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] animate-pulse" 
                      : "border-rose-500/30 bg-slate-900/40 hover:bg-rose-500/10 hover:border-rose-500/60 text-white"
                  }`}
                >
                  <AlertTriangle className={`w-8 h-8 text-rose-500 transition-transform ${isSirenPlaying ? "scale-110" : "group-hover:scale-110"}`} />
                  <span className="text-lg font-extrabold text-rose-500 tracking-tight">
                    {isSirenPlaying ? "إيقاف صفارات الإنذار" : "إطلاق صفارات الإنذار الفورية!"}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-rose-400/80 uppercase tracking-widest">
                    {isSirenPlaying ? "Deactivate Emergency Siren" : "Amplify Emergency Satellite Siren"}
                  </span>
                </button>

                <div className="text-center mt-2">
                  <span className="text-[10px] font-mono text-slate-500 tracking-wider">ALERT FREQ CHANNELS: 156.8 MHz (VHF Ch 16)</span>
                </div>
              </div>


            </div>
          </div>
        )}

        {/* ======================= TAB 3: THREAT ASSESSMENT ======================= */}
        {activeTab === "threat" && (
          <ThreatAssessment 
            result={detectionResult} 
            metrics={metrics} 
            lang={lang} 
            theme={theme}
          />
        )}

        {/* BOTTOM LEDGER AND RECENT SCAN RECORDS */}
        {activeTab === "image" && radarLogs.length > 0 && (
          <div className="mt-6">
            <HistoryLog 
              logs={radarLogs} 
              activeLogId={activeLogId} 
              onSelectLog={handleSelectHistoryLog} 
              onClearLogs={handleClearHistory} 
              lang={lang}
              theme={theme}
            />
          </div>
        )}

      </main>

      {/* FOOTER METRICS AND SECURITY ADVISORIES */}
      <footer className="w-full bg-slate-950/95 py-3.5 border-t border-white/5 md:px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-slate-500 text-xs px-4 gap-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 font-medium font-sans">© 2026 AI Aerospace Command • Secured Satellite Relay</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className={`flex items-center gap-1.5 ${yoloStatus.online ? "text-emerald-500" : "text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full status-active-pulse ${yoloStatus.online ? "bg-emerald-500" : "bg-slate-600"}`}></span>
              {yoloStatus.online ? "YOLO SERVICE: ONLINE" : "YOLO SERVICE: OFFLINE"}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-active-pulse"></span>
              ENCRYPTION ACTIVE: SHA-512
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-300">GEO NODE: RY-X11</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
