/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
// @ts-ignore
import emergencyAlarmSound from "../freesound_community-emergency-alarm-with-reverb-29431.mp3";
import { 
  ShieldAlert, 
  Download, 
  AlertTriangle, 
  Compass, 
  Activity, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  Terminal, 
  Bomb, 
  Radio, 
  Volume2, 
  VolumeX,
  FileSpreadsheet,
  PlusCircle,
  HelpCircle,
  Play,
  Square
} from "lucide-react";
import { DetectionResult, SystemMetrics } from "../types";
import { translations } from "../translations";

interface ThreatAssessmentProps {
  result: DetectionResult | null;
  metrics: SystemMetrics;
  lang: "ar" | "en";
  theme: "dark" | "light";
}

export function ThreatAssessment({ result, metrics, lang, theme }: ThreatAssessmentProps) {
  const [alertLevel, setAlertLevel] = useState<"safe" | "vigilance" | "emergency">("vigilance");
  const [sectorPeacetime, setSectorPeacetime] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);
  const [alarmMuted, setAlarmMuted] = useState<boolean>(true);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [soundMode, setSoundMode] = useState<"siren" | "rwr">("rwr");
  const [manualRwrStage, setManualRwrStage] = useState<"search" | "track" | "lock" | "missile" | null>(null);
  const t = translations[lang];

  const defaultArMsg = "تحذير عاجل للمجال الجوي: رصد اختراق حرج للقطاع - تفعيل فوري لمنظومات الردع والدفاع الجوي وبث إشارة إنزار الحرس";
  const defaultEnMsg = "URGENT AIRSPACE WARNING: CRITICAL SECTOR PENETRATION REVEALED - SCRAMBLE ALL REGIONAL AIR DEFENSE BATTERIES";

  const [customAlertMsg, setCustomAlertMsg] = useState<string>("");
  const [hasUserEditedMsg, setHasUserEditedMsg] = useState<boolean>(false);

  // Initialize or reset based on language change if the user has not edited it manually
  React.useEffect(() => {
    if (!hasUserEditedMsg) {
      setCustomAlertMsg(lang === "ar" ? defaultArMsg : defaultEnMsg);
    }
  }, [lang, hasUserEditedMsg]);

  // Modern Web Audio realistic military radio signal beep, preamble, and Speech System
  const playEmergencyBroadcastAndSpeech = (forceText?: string) => {
    if (typeof window === "undefined") return;

    // Auto-unmute if muted so the user gets instant feedback
    if (alarmMuted) {
      setAlarmMuted(false);
    }

    // Play local emergency alert MP3 sound resource
    try {
      if (!emergencyBroadcastAudioRef.current) {
        emergencyBroadcastAudioRef.current = new Audio(emergencyAlarmSound);
      }
      emergencyBroadcastAudioRef.current.currentTime = 0;
      emergencyBroadcastAudioRef.current.volume = 0.55;
      emergencyBroadcastAudioRef.current.play().catch((err) => {
        console.warn("Local emergency alarm audio play blocked by user gesture:", err);
      });
    } catch (err) {
      console.warn("Failed to play local emergency alarm audio:", err);
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      
      // Squelch static burst noise
      const bufferSize = ctx.sampleRate * 0.15; // 150ms burst
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.04, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();

      // High pitch double-pip alert frequency beep
      const schedPip = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, time);
        osc.type = "sine";
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
        gain.gain.setValueAtTime(0.15, time + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
      };

      // Play tactical frequency beep sequences
      schedPip(ctx.currentTime + 0.12, 950);
      schedPip(ctx.currentTime + 0.30, 950);
      schedPip(ctx.currentTime + 0.48, 1150);

      // Clean close of ctx
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1000);
    } catch (err) {
      console.log("Audio preamble blocked or unsupported:", err);
    }

    // Trigger Speech Engine
    setTimeout(() => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(true);

        const currentMsg = forceText || customAlertMsg;
        const textToSpeak = lang === "ar"
          ? `بث نداء الطوارئ الجوي والفوري. ${currentMsg}`
          : `Emergency Broadcast Alert. ${currentMsg}`;
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang === "ar" ? "ar-SA" : "en-US";
        utterance.rate = lang === "ar" ? 0.82 : 0.88; // Majestic clinical transmission rate
        utterance.pitch = lang === "ar" ? 0.95 : 0.85; // Low command tone

        utterance.onstart = () => {
          setIsSpeaking(true);
          if (mainGainRef.current && audioCtxRef.current) {
            const actx = audioCtxRef.current;
            mainGainRef.current.gain.setValueAtTime(mainGainRef.current.gain.value, actx.currentTime);
            mainGainRef.current.gain.linearRampToValueAtTime(0.02, actx.currentTime + 0.15); // Duck siren down to 2%
          }
        };

        const handleSpeechEnd = () => {
          setIsSpeaking(false);
          if (mainGainRef.current && audioCtxRef.current && isAlarmActive) {
            const actx = audioCtxRef.current;
            mainGainRef.current.gain.setValueAtTime(mainGainRef.current.gain.value, actx.currentTime);
            mainGainRef.current.gain.linearRampToValueAtTime(0.18, actx.currentTime + 0.4); // Restore volume
          }
        };

        utterance.onend = handleSpeechEnd;
        utterance.onerror = handleSpeechEnd;

        window.speechSynthesis.speak(utterance);
      }
    }, 800);
  };

  const stopEmergencyBroadcastAndSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    if (emergencyBroadcastAudioRef.current) {
      try {
        emergencyBroadcastAudioRef.current.pause();
        emergencyBroadcastAudioRef.current.currentTime = 0;
      } catch (err) {}
    }
    if (mainGainRef.current && audioCtxRef.current && isAlarmActive) {
      const actx = audioCtxRef.current;
      mainGainRef.current.gain.setValueAtTime(mainGainRef.current.gain.value, actx.currentTime);
      mainGainRef.current.gain.linearRampToValueAtTime(0.18, actx.currentTime + 0.2);
    }
  };

  const alertPresets = [
    {
      id: "air-raid",
      nameEn: "Air Raid Siren Alert",
      nameAr: "إنذار غارة جوية",
      msgEn: "AIR RAID ALERT: UNIDENTIFIED TACTICAL AIRCRAFT PENETRATING REGIONAL BOUNDS. SEEK SECURE DEFENSIVE SHELTER IMMEDIATELY.",
      msgAr: "إنذار غارة جوية: اختراق طيران قتالي مجهول فائق السرعة للحدود الإقليمية. يرجى أخذ التدابير الدفاعية فوراً."
    },
    {
      id: "civil-freeze",
      nameEn: "Civil Airspace Freeze",
      nameAr: "تجميد الممر المدني",
      msgEn: "CIVIL AIRSPACE DIRECTIVE: TEMPORARY CORRIDOR FREEZE IN EFFECT IMMEDIATELY. ALL SHIFT FLIGHTS COMMENCE GROUNDING PROTOCOLS.",
      msgAr: "توجيه الفضاء الجوي المدني: تجميد فوري لجميع المسارات والممرات الجوية. يرجى من كافة الرحلات النشطة بدء بروتوكول الهبوط."
    },
    {
      id: "scramble",
      nameEn: "Fighter Scramble Protocol",
      nameAr: "استنفار الطيران المقاتل",
      msgEn: "INTERCEPT SCRAMBLE PROTOCOL ENGAGED: SATELLITE RADAR SENSORS ALIGNED. IMMEDIATE COMPLIANCE WITH VECTOR COMMANDS REQUIRED.",
      msgAr: "تفعيل بروتوكول الاعتراض الجوي: محاذاة أجهزة المسح والرادارات. يرجى الانصياع الفوري لتوجيهات قطاع الملاحة العسكرية."
    }
  ];

  // Web Audio refs for the continuous war alarm mechanical sweep
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const osc1Ref = React.useRef<OscillatorNode | null>(null);
  const osc2Ref = React.useRef<OscillatorNode | null>(null);
  const lfoRef = React.useRef<OscillatorNode | null>(null);
  const mainGainRef = React.useRef<GainNode | null>(null);
  const pixabayAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const emergencyBroadcastAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Web Audio refs for RWR Avionics sound mode
  const rwrNodesRef = React.useRef<any[]>([]);
  const rwrIntervalRef = React.useRef<any | null>(null);

  // Stop alarm synthesized sound cleanly
  const stopAlarmSound = () => {
    try {
      // Clear RWR beeping interval
      if (rwrIntervalRef.current) {
        clearInterval(rwrIntervalRef.current);
        rwrIntervalRef.current = null;
      }

      // Stop any spawned RWR nodes
      if (rwrNodesRef.current && rwrNodesRef.current.length > 0) {
        rwrNodesRef.current.forEach((node) => {
          try {
            node.stop();
          } catch (e) {}
        });
        rwrNodesRef.current = [];
      }

      if (mainGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        // ramp down volume quickly for smooth fade-out instead of abrupt clicks
        mainGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
        mainGainRef.current.gain.setValueAtTime(mainGainRef.current.gain.value, ctx.currentTime);
        mainGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      }

      setTimeout(() => {
        if (osc1Ref.current) {
          try { osc1Ref.current.stop(); } catch (err) {}
          osc1Ref.current = null;
        }
        if (osc2Ref.current) {
          try { osc2Ref.current.stop(); } catch (err) {}
          osc2Ref.current = null;
        }
        if (lfoRef.current) {
          try { lfoRef.current.stop(); } catch (err) {}
          lfoRef.current = null;
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
      }, 160);
    } catch (err) {
      console.log("Error turning off alarm synthesized sound:", err);
    }
  };

  // Play/Stop continuous air raid war alert siren or combat cockpit RWR receiver
  React.useEffect(() => {
    // 1. Initially stop any running oscillators or intervals for clean mode-switches
    stopAlarmSound();
    if (pixabayAudioRef.current) {
      try {
        pixabayAudioRef.current.pause();
        pixabayAudioRef.current.currentTime = 0;
      } catch (err) {}
    }

    if (isAlarmActive && !alarmMuted) {
      if (soundMode === "siren") {
        // --- 🚨 MODE 1: CIVILIAN AIR RAID MECHANICAL SIREN + PIXABAY MP3 ---
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtxClass();
          audioCtxRef.current = ctx;

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const mainGain = ctx.createGain();

          osc1.type = "sawtooth";
          osc2.type = "triangle";

          // Heavy mechanical air raid drone frequencies
          osc1.frequency.value = 360;
          osc2.frequency.value = 440;

          lfo.type = "sine";
          lfo.frequency.value = 0.22; // sweep pitch cycle rate (~4.5 seconds)

          lfoGain.gain.value = 140;

          lfo.connect(lfoGain);
          lfoGain.connect(osc1.frequency);
          lfoGain.connect(osc2.frequency);

          osc1.connect(mainGain);
          osc2.connect(mainGain);

          mainGain.gain.setValueAtTime(0, ctx.currentTime);
          mainGain.gain.linearRampToValueAtTime(0.20, ctx.currentTime + 0.5);

          mainGain.connect(ctx.destination);

          lfo.start();
          osc1.start();
          osc2.start();

          osc1Ref.current = osc1;
          osc2Ref.current = osc2;
          lfoRef.current = lfo;
          mainGainRef.current = mainGain;
        } catch (e) {
          console.warn("Classic web audio compilation failed:", e);
        }

        // Play Pixabay air-raid-siren-of-the-second-world-war-7010
        try {
          if (!pixabayAudioRef.current) {
            pixabayAudioRef.current = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c4070a7b48.mp3");
            pixabayAudioRef.current.loop = true;
            pixabayAudioRef.current.crossOrigin = "anonymous";
          }
          pixabayAudioRef.current.volume = 0.6;
          pixabayAudioRef.current.currentTime = 0;
          pixabayAudioRef.current.play().catch((err) => {
            console.warn("Direct Pixabay MP3 playback paused/blocked. Falling back to localized Web Audio synthesis:", err);
          });
        } catch (err) {
          console.warn("Error starting Pixabay MP3 Audio Player:", err);
        }

      } else {
        // --- 🛩️ MODE 2: COMBAT RADAR WARNING RECEIVER (RWR) lock-on alarms ---
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtxClass();
          audioCtxRef.current = ctx;

          // Local threat scoring math to calculate automatic threats in the active sound effect loop
          const list = result?.aircrafts || [];
          const total = list.length;
          const militaryCount = list.filter(item => 
            item.aircraftType.toLowerCase().includes("military") || 
            item.aircraftType.includes("عسكري")
          ).length;
          const dronesCount = list.filter(item => 
            item.aircraftType.toLowerCase().includes("drone") || 
            item.aircraftType.includes("مسيرة")
          ).length;
          
          const baseThreatScore = total > 0
            ? Math.round((militaryCount / total) * 60 + (dronesCount / total) * 20)
            : 10;
          const multiplier = alertLevel === "safe" ? 0.6 : alertLevel === "vigilance" ? 1.0 : 1.4;
          const rawThreat = Math.round(baseThreatScore * multiplier + (sectorPeacetime ? -15 : 20));
          const finalThreat = Math.max(5, Math.min(100, rawThreat));

          // Resolve RWR warning severity level based on user overrides or automatically computed airspace score
          const resolvedRwrStage = manualRwrStage || (
            finalThreat <= 35 ? "search" :
            finalThreat <= 70 ? "track" :
            finalThreat <= 88 ? "lock" : "missile"
          );

          // Background master Gain for seamless routing
          const rwrMainGain = ctx.createGain();
          rwrMainGain.gain.setValueAtTime(0, ctx.currentTime);
          rwrMainGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.25); // fast combat sound engagement
          rwrMainGain.connect(ctx.destination);
          
          mainGainRef.current = rwrMainGain;

          // A: Cockpit Ambient Jet Rumbling Engine Hum
          const humOsc = ctx.createOscillator();
          const humFilter = ctx.createBiquadFilter();
          const humGain = ctx.createGain();
          humOsc.type = "sawtooth";
          humOsc.frequency.setValueAtTime(45, ctx.currentTime); // low-frequency cabin resonance
          humFilter.type = "lowpass";
          humFilter.frequency.setValueAtTime(105, ctx.currentTime); // filter severe harmonics
          humGain.gain.setValueAtTime(0.08, ctx.currentTime); // ambient background volume level
          
          humOsc.connect(humFilter);
          humFilter.connect(humGain);
          humGain.connect(rwrMainGain);
          humOsc.start();

          // B: Cockpit Ventilators + High Frequency Avionics whine (electrical hiss, peak/notch filtered)
          const bSize = ctx.sampleRate * 2.0;
          const bBuffer = ctx.createBuffer(1, bSize, ctx.sampleRate);
          const bData = bBuffer.getChannelData(0);
          for (let i = 0; i < bSize; i++) {
            bData[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = bBuffer;
          whiteNoise.loop = true;

          const staticFilter = ctx.createBiquadFilter();
          staticFilter.type = "bandpass";
          staticFilter.frequency.setValueAtTime(1550, ctx.currentTime);
          staticFilter.Q.setValueAtTime(3.5, ctx.currentTime);

          const staticGain = ctx.createGain();
          staticGain.gain.setValueAtTime(0.005, ctx.currentTime);

          // LFO to simulate cockpit radio electronics wave static interference
          const crackleLfo = ctx.createOscillator();
          const crackleGain = ctx.createGain();
          crackleLfo.type = "triangle";
          crackleLfo.frequency.setValueAtTime(2.8, ctx.currentTime); // slow intermittent waves
          crackleGain.gain.setValueAtTime(0.004, ctx.currentTime);

          crackleLfo.connect(crackleGain);
          crackleGain.connect(staticGain.gain);

          whiteNoise.connect(staticFilter);
          staticFilter.connect(staticGain);
          staticGain.connect(rwrMainGain);

          whiteNoise.start();
          crackleLfo.start();

          // Save references of active background ambient oscillators
          const rwrActiveNodes: any[] = [humOsc, whiteNoise, crackleLfo];

          // C: High-frequency clinical avionics system hardware whine
          const whistleOsc = ctx.createOscillator();
          const whistleGain = ctx.createGain();
          whistleOsc.type = "sine";
          whistleOsc.frequency.setValueAtTime(360, ctx.currentTime);
          whistleGain.gain.setValueAtTime(0.006, ctx.currentTime);
          whistleOsc.connect(whistleGain);
          whistleGain.connect(rwrMainGain);
          whistleOsc.start();
          
          rwrActiveNodes.push(whistleOsc);

          // D: Tactical warning pulse sequence based on threat state
          if (resolvedRwrStage === "search") {
            // SEARCH: Radar surveillance sweep detected. Play double-chirp beeps every 1.8 seconds.
            const playSearchSweep = () => {
              const now = ctx.currentTime;
              for (let i = 0; i < 2; i++) {
                const delay = i * 0.16;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = "square";
                osc.frequency.setValueAtTime(1120, now + delay);
                osc.frequency.exponentialRampToValueAtTime(780, now + delay + 0.08);

                gain.gain.setValueAtTime(0, now + delay);
                gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

                const bandpass = ctx.createBiquadFilter();
                bandpass.type = "bandpass";
                bandpass.frequency.setValueAtTime(950, now + delay);
                bandpass.Q.setValueAtTime(1.2, now + delay);

                osc.connect(gain);
                gain.connect(bandpass);
                bandpass.connect(rwrMainGain);

                osc.start(now + delay);
                osc.stop(now + delay + 0.1);
              }
            };

            playSearchSweep();
            rwrIntervalRef.current = setInterval(playSearchSweep, 1800);

          } else if (resolvedRwrStage === "track") {
            // TRACK: Constant radar painting/tracking. Pulsing dual-tone chord beeps (2.2 Hz)
            const playTrackNails = () => {
              const now = ctx.currentTime;
              const o1 = ctx.createOscillator();
              const o2 = ctx.createOscillator();
              const g = ctx.createGain();

              o1.type = "triangle";
              o1.frequency.setValueAtTime(800, now);
              
              o2.type = "square";
              o2.frequency.setValueAtTime(815, now); // digital detuned chord feel

              g.gain.setValueAtTime(0, now);
              g.gain.linearRampToValueAtTime(0.06, now + 0.012);
              g.gain.setValueAtTime(0.06, now + 0.11);
              g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

              const lowpass = ctx.createBiquadFilter();
              lowpass.type = "lowpass";
              lowpass.frequency.setValueAtTime(1550, now); // soften harshness

              o1.connect(g);
              o2.connect(g);
              g.connect(lowpass);
              lowpass.connect(rwrMainGain);

              o1.start(now);
              o2.start(now);
              o1.stop(now + 0.2);
              o2.stop(now + 0.2);
            };

            playTrackNails();
            rwrIntervalRef.current = setInterval(playTrackNails, 450);

          } else if (resolvedRwrStage === "lock") {
            // LOCK: Target lock acquired! Rapid, frantic warning pips (6.6 Hz)
            const playLockAlert = () => {
              const now = ctx.currentTime;
              const osc = ctx.createOscillator();
              const oscDetune = ctx.createOscillator();
              const gain = ctx.createGain();

              osc.type = "square";
              osc.frequency.setValueAtTime(1250, now);

              oscDetune.type = "sine";
              oscDetune.frequency.setValueAtTime(1253, now);

              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
              gain.gain.setValueAtTime(0.12, now + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

              const filter = ctx.createBiquadFilter();
              filter.type = "lowpass";
              filter.frequency.setValueAtTime(1800, now);

              osc.connect(gain);
              oscDetune.connect(gain);
              gain.connect(filter);
              filter.connect(rwrMainGain);

              osc.start(now);
              oscDetune.start(now);
              osc.stop(now + 0.1);
              oscDetune.stop(now + 0.1);
            };

            playLockAlert();
            rwrIntervalRef.current = setInterval(playLockAlert, 150);

          } else if (resolvedRwrStage === "missile") {
            // MISSILE: Missile launch detected! Extreme screaming dual alternating pitch warble.
            const oMissile1 = ctx.createOscillator();
            const oMissile2 = ctx.createOscillator();
            const mGain = ctx.createGain();

            oMissile1.type = "square";
            oMissile2.type = "square";

            oMissile1.frequency.setValueAtTime(1750, ctx.currentTime);
            oMissile2.frequency.setValueAtTime(1980, ctx.currentTime);

            // Pitch LFO for 14Hz screaming warble bend
            const warbleOsc = ctx.createOscillator();
            const warbleGainNode = ctx.createGain();
            warbleOsc.type = "square";
            warbleOsc.frequency.setValueAtTime(14, ctx.currentTime);
            warbleGainNode.gain.setValueAtTime(250, ctx.currentTime);

            warbleOsc.connect(warbleGainNode);
            warbleGainNode.connect(oMissile1.frequency);
            warbleGainNode.connect(oMissile2.frequency);

            // Volume Gating LFO for 11Hz chopper sound gated pulse
            const pulseOsc = ctx.createOscillator();
            const pulseGainNode = ctx.createGain();
            pulseOsc.type = "square";
            pulseOsc.frequency.setValueAtTime(11, ctx.currentTime);
            pulseGainNode.gain.setValueAtTime(0.08, ctx.currentTime);

            pulseOsc.connect(pulseGainNode);

            oMissile1.connect(mGain);
            oMissile2.connect(mGain);

            const mFilter = ctx.createBiquadFilter();
            mFilter.type = "lowpass";
            mFilter.frequency.setValueAtTime(2400, ctx.currentTime);

            mGain.gain.setValueAtTime(0, ctx.currentTime);
            mGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.15);

            const gateNode = ctx.createGain();
            gateNode.gain.setValueAtTime(0.06, ctx.currentTime);
            
            pulseGainNode.connect(gateNode.gain);

            mGain.connect(mFilter);
            mFilter.connect(gateNode);
            gateNode.connect(rwrMainGain);

            warbleOsc.start();
            pulseOsc.start();
            oMissile1.start();
            oMissile2.start();

            rwrActiveNodes.push(warbleOsc, pulseOsc, oMissile1, oMissile2, gateNode);
          }

          rwrNodesRef.current = rwrActiveNodes;

        } catch (err) {
          console.error("Failed to start cockpit RWR alarm:", err);
        }
      }
    } else {
      stopAlarmSound();
      if (pixabayAudioRef.current) {
        try {
          pixabayAudioRef.current.pause();
          pixabayAudioRef.current.currentTime = 0;
        } catch (err) {}
      }
      if (emergencyBroadcastAudioRef.current) {
        try {
          emergencyBroadcastAudioRef.current.pause();
          emergencyBroadcastAudioRef.current.currentTime = 0;
        } catch (err) {}
      }
    }

    // Clean up nodes on unmount
    return () => {
      stopAlarmSound();
      if (pixabayAudioRef.current) {
        try {
          pixabayAudioRef.current.pause();
        } catch (err) {}
      }
      if (emergencyBroadcastAudioRef.current) {
        try {
          emergencyBroadcastAudioRef.current.pause();
        } catch (err) {}
      }
    };
  }, [isAlarmActive, alarmMuted, soundMode, manualRwrStage, result, alertLevel, sectorPeacetime]);

  const list = result?.aircrafts || [];
  const total = list.length;
  const isLight = theme === "light";
  
  const militaryList = list.filter(item => 
    item.aircraftType.toLowerCase().includes("military") || 
    item.aircraftType.includes("عسكري")
  );
  
  const dronesList = list.filter(item => 
    item.aircraftType.toLowerCase().includes("drone") || 
    item.aircraftType.includes("مسيرة")
  );

  const militaryCount = militaryList.length;
  const dronesCount = dronesList.length;
  const civilianCount = total - militaryCount;

  // Dynamically calculate dynamic risk score based on targets and defense parameters
  const baseThreatScore = total > 0
    ? Math.round((militaryCount / total) * 60 + (dronesCount / total) * 20)
    : 10;
     
  const multiplier = alertLevel === "safe" ? 0.6 : alertLevel === "vigilance" ? 1.0 : 1.4;
  const rawThreat = Math.round(baseThreatScore * multiplier + (sectorPeacetime ? -15 : 20));
  const finalThreatScore = Math.max(5, Math.min(100, rawThreat));

  const resolvedRwrStage = manualRwrStage || (
    finalThreatScore <= 35 ? "search" :
    finalThreatScore <= 70 ? "track" :
    finalThreatScore <= 88 ? "lock" : "missile"
  );

  // Strategic classification
  let threatSeverityAr = lang === "ar" ? "منخفض / مراقبة اعتيادية" : "LOW / ROUTINE AIRSPACE";
  let threatColor = "text-emerald-500 dark:text-emerald-400";
  
  if (finalThreatScore > 35 && finalThreatScore <= 70) {
    threatSeverityAr = lang === "ar" ? "متوسط / دوريات يقظة" : "MODERATE / VIGILANT PATROL";
    threatColor = "text-amber-500 dark:text-amber-400";
  } else if (finalThreatScore > 70) {
    threatSeverityAr = lang === "ar" ? "حرج / تأهب دفاعي شامل" : "CRITICAL / HIGH ALERT DEFENSE";
    threatColor = "text-rose-500 dark:text-rose-400";
  }

  // Triggering the red flashing alarm response
  const handleTriggerAlarm = () => {
    const nextState = !isAlarmActive;
    setIsAlarmActive(nextState);
    if (nextState) {
      // Automatically unmute so they can hear the epic mechanical war siren immediately!
      setAlarmMuted(false);
      setShowNotification(t.emergencyAlertDispatched);
      setTimeout(() => {
        playEmergencyBroadcastAndSpeech();
      }, 100);
      setTimeout(() => setShowNotification(null), 6000);
    }
  };

  // Generate and download military-grade report in translated template
  const handleDownloadReport = () => {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    const sectorCoords = metrics.gpsCoords;
    
    let reportText = `===========================================================
    ${t.appTitle.toUpperCase()}
    ${t.appSubTitle.toUpperCase()}
===========================================================

[1] ${t.airspaceDossier}
-----------------------------------------------
Report Issued: ${timestamp}
Observation Coordinates: ${sectorCoords}
Calculated Threat Level: ${finalThreatScore}% (${threatSeverityAr})
Radar Alert Tier: ${alertLevel.toUpperCase()}
Geopolitical Designation: ${sectorPeacetime ? t.peacetimeAccord : t.activeTacticalOps}
Analysis Mechanism: ${t.analysisMechanism}

[2] ${t.airspaceInventory}
---------------------------------------------------------
Total Monitored Air Targets: ${total}
• ${t.tacticalCombatAircraft}: ${militaryCount}
• ${t.unmannedAerialSystems}: ${dronesCount}
• ${t.civilCommercialAircraft}: ${civilianCount}

[3] ${t.classifiedTargetsLedger}
---------------------------------------------------------
`;

    if (list.length === 0) {
      reportText += `${t.noActiveTargetsObserved}\n`;
    } else {
      list.forEach((aircraft, idx) => {
        reportText += `Target [${idx + 1}] : ${aircraft.aircraftName}
- Intelligence Classification: ${aircraft.aircraftType === "Military" ? t.military : t.civilian}
- Match Pattern Confidence: ${Math.round(aircraft.confidence * 100)}%
- Bounding Coordinates Matrix: [ymin: ${aircraft.ymin}, xmin: ${aircraft.xmin}, ymax: ${aircraft.ymax}, xmax: ${aircraft.xmax}]
- Tactical Description: ${aircraft.descriptionAr || 'No description available'}
---------------------------------------------------------\n`;
      });
    }

    reportText += `
[4] ${t.tacticalAirspaceDirectives}
---------------------------------------------------------
Based on the high-fidelity automated defense evaluation of this sector, the following protocol is recommended:
${finalThreatScore > 75 
  ? `1. Initiate Defcon-1 Airspace Emergencies. Engage remote airspace interdiction arrays and patriot batteries immediately.
2. Scramble tactical interceptor sweeps to engage hostile incursions and track high-speed low-altitude signatures.
3. Completely freeze and suspend commercial civil flight passages inside the sector corridors and restrict radio frequencies.`  
  : finalThreatScore > 40
  ? `1. Elevate radar pulse frequencies to maximum. Perform continuous 20-second coordinate-updated sweeping circles.
2. Deploy drone reconnaissance surveillance squadrons to cover remote outer boundaries of the airspace sector.
3. Sustain consistent satellite relays with commercial airlines and civilian towers to guarantee routing security.`
  : `1. Maintain Routine Base Guard Status. Observe flight tracks along pre-approved corridors during normal operations.
2. Conduct standardized non-disruptive sensor tuning cycles without interrupting active sweep grids.`
}

---------------------------------------------------------
End of Cryptographic Intelligence Report • CLASSIFIED TOP SECRET JURISDICTIONAL DOCUMENT.
AI Command System Hub © 2026 UTC.
===========================================================`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Threat_Assessment_Report_Sector_${sectorCoords.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* Realtime Broadcast Warning Banner */}
      {isAlarmActive && (
        <div className="flex flex-col md:flex-row items-center gap-3 bg-red-600 border border-red-500 text-white p-4.5 rounded-2xl mb-6 shadow-xl relative overflow-hidden animate-pulse">
          <div className="shrink-0 bg-white/20 backdrop-blur-sm border border-white/20 text-white rounded-full p-2.5 animate-bounce">
            <Radio className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 text-center md:text-left">
            <p className="font-mono text-[10px] uppercase font-black tracking-widest text-red-100 flex items-center justify-center md:justify-start gap-1">
              <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping"></span>
              {lang === "ar" ? "بث إنذار طارئ جوي نشط [تردد طوارئ الحرس 156.8 ميغاهرتز]" : "ACTIVE EMERGENCY RADAR BROADCAST [GUARD FREQUENCY 156.8 MHz]"}
            </p>
            <p className="text-sm font-black text-white uppercase tracking-tight mt-1 whitespace-pre-wrap">
              {customAlertMsg}
            </p>
          </div>
        </div>
      )}

      {/* Red flashing screen overlay when emergency alarm is triggered */}
      {isAlarmActive && (
        <div className="absolute inset-0 bg-red-600/5 border border-red-500 rounded-3xl pointer-events-none animate-pulse z-10"></div>
      )}

      {/* Main Threat layout - redesigned side-by-side after removing the main criteria block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Emergency Alert & Audio trigger Panel */}
        <div className={`p-6 rounded-2xl border flex flex-col justify-between h-full min-h-[320px] transition-all ${
          isLight 
            ? "bg-white border-slate-200/80 shadow-[0_4px_15px_rgba(148,163,184,0.05)] text-slate-800" 
            : "glass-card border-sky-500/10 text-slate-100"
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isLight ? "border-slate-100" : "border-white/5"}`}>
              <h4 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                <Bomb className="w-4 h-4 text-rose-500 animate-spin" style={{ animationDuration: "12s" }} />
                {t.broadcastEmergencyAlert}
              </h4>
              {/* Mute toggle */}
              <button
                type="button"
                onClick={() => setAlarmMuted(!alarmMuted)}
                className={`p-1 px-2.5 border rounded cursor-pointer transition-all flex items-center gap-1 ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900" 
                    : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                }`}
                title={alarmMuted ? t.unmuteAudio : t.muteAudio}
              >
                {alarmMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />}
                <span className="text-[9px] font-mono font-medium">{alarmMuted ? "MUTE" : "AUDIO"}</span>
              </button>
            </div>

            <p className={`text-xs leading-relaxed mb-4 ${isLight ? "text-slate-600" : "text-slate-350"}`}>
              {t.alarmDesc}
            </p>

            {/* Audio Signal Configuration (Classic Siren / Fighter RWR) */}
            <div className={`p-3.5 mb-4 rounded-xl border transition-all ${
              isLight ? "bg-slate-50/50 border-slate-200" : "bg-slate-950/20 border-white/5"
            }`}>
              <div className="flex items-center justify-between mb-3 text-left">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {lang === "ar" ? "نظام الإشارة الصوتي للإنذار:" : "ALARM AUDIO SOURCE SYSTEM:"}
                </span>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSoundMode("siren");
                      setManualRwrStage(null);
                    }}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold font-mono transition-all cursor-pointer ${
                      soundMode === "siren"
                        ? "bg-rose-500 text-slate-950 shadow-md"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    SIREN
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoundMode("rwr")}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold font-mono transition-all cursor-pointer ${
                      soundMode === "rwr"
                        ? "bg-sky-500 text-slate-950 shadow-md"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    RWR AVIONICS
                  </button>
                </div>
              </div>

              {soundMode === "rwr" && (
                <div className="space-y-3">
                  {/* Escalate / Threats sync stages */}
                  <div className="text-left">
                    <span className="text-[9px] font-mono text-slate-400 block mb-1.5 uppercase font-bold tracking-tight">
                      {lang === "ar" ? "عتبة تصعيد الرادار (أطوار القفل وجرس الإنذار):" : "RWR THREAT TRACK ESCALATION STAGE:"}
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        onClick={() => setManualRwrStage(null)}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-all cursor-pointer ${
                          manualRwrStage === null
                            ? "bg-sky-600 text-white"
                            : "bg-slate-900 border border-white/5 text-slate-450 hover:text-white"
                        }`}
                        title="Automatically scales alarm intensity based on dynamic airspace risk calculation"
                      >
                        [AUTO]
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualRwrStage("search")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-all cursor-pointer ${
                          manualRwrStage === "search" || (manualRwrStage === null && finalThreatScore <= 35)
                            ? "bg-emerald-600 text-white font-black"
                            : "bg-slate-900 border border-white/5 text-slate-450 hover:text-white"
                        }`}
                      >
                        SEARCH
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualRwrStage("track")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-all cursor-pointer ${
                          manualRwrStage === "track" || (manualRwrStage === null && finalThreatScore > 35 && finalThreatScore <= 70)
                            ? "bg-amber-600 text-white font-black"
                            : "bg-slate-900 border border-white/5 text-slate-450 hover:text-white"
                        }`}
                      >
                        TRACK
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualRwrStage("lock")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-all cursor-pointer ${
                          manualRwrStage === "lock" || (manualRwrStage === null && finalThreatScore > 70 && finalThreatScore <= 88)
                            ? "bg-orange-600 text-white font-black"
                            : "bg-slate-900 border border-white/5 text-slate-450 hover:text-white"
                        }`}
                      >
                        LOCK-ON
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualRwrStage("missile")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-all cursor-pointer ${
                          manualRwrStage === "missile" || (manualRwrStage === null && finalThreatScore > 88)
                            ? "bg-red-650 text-white animate-pulse font-black"
                            : "bg-slate-900 border border-white/5 text-slate-450 hover:text-white"
                        }`}
                      >
                        LAUNCH
                      </button>
                    </div>
                  </div>

                  {/* Absolute stunner: Cockpit RWR vector scopes displays */}
                  <div className="relative p-2 rounded-xl bg-slate-950 border border-sky-500/20 flex flex-col md:flex-row items-center gap-3">
                    {/* SVG scope radar */}
                    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center overflow-hidden bg-slate-950 rounded-lg border border-white/5">
                      {/* Grid circles */}
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(14, 165, 233, 0.12)" strokeWidth="1" />
                        <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(14, 165, 233, 0.08)" strokeWidth="0.8" strokeDasharray="1 1" />
                        
                        {/* crosshairs */}
                        <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(14, 165, 233, 0.1)" strokeWidth="0.8" />
                        <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(14, 165, 233, 0.1)" strokeWidth="0.8" />
                        
                        {/* Constantly scanning sweep sweep */}
                        {isAlarmActive && (
                          <line
                            x1="50"
                            y1="50"
                            x2="50"
                            y2="5"
                            className="origin-[50px_50px] animate-spin"
                            stroke="rgba(14, 165, 233, 0.4)"
                            strokeWidth="1.5"
                            style={{ animationDuration: "3.5s" }}
                          />
                        )}

                        {/* Center fighter delta */}
                        <polygon
                          points="50,42 45,55 50,52 55,55"
                          className={manualRwrStage === "missile" || (manualRwrStage === null && finalThreatScore > 88) ? "fill-red-500 animate-pulse" : "fill-sky-400"}
                        />
                        
                        {/* Simulated hostile lock indicators */}
                        {isAlarmActive && (
                          <>
                            {/* Hostile air radar tracking target painting */}
                            <g transform="translate(25, 28)">
                              <rect x="-3" y="-3" width="6" height="6" fill="none" stroke={resolvedRwrStage === "search" ? "#10b981" : "#f59e0b"} strokeWidth="1" className="animate-pulse" />
                              <text x="5" y="2" fill={resolvedRwrStage === "search" ? "#10b981" : "#f59e0b"} fontSize="4.5" fontFamily="monospace" fontWeight="bold">29</text>
                            </g>
                            {resolvedRwrStage !== "search" && (
                              <g transform="translate(70, 32)">
                                <circle r="3" fill="none" stroke={resolvedRwrStage === "missile" ? "#ef4444" : "#f97316"} strokeWidth="1" className="animate-ping" style={{ animationDuration: resolvedRwrStage === "missile" ? "0.3s" : "0.8s" }} />
                                <polygon points="0,-3 -3,3 3,3" fill="none" stroke={resolvedRwrStage === "missile" ? "#ef4444" : "#f97316"} strokeWidth="1" />
                                <text x="5" y="2" fill={resolvedRwrStage === "missile" ? "#ef4444" : "#f97316"} fontSize="4.5" fontFamily="monospace" fontWeight="bold">15</text>
                                {/* Vector line from hostile locking to aircraft */}
                                <line x1="0" y1="0" x2="-20" y2="18" stroke={resolvedRwrStage === "missile" ? "rgba(239, 68, 68, 0.4)" : "rgba(249, 115, 22, 0.25)"} strokeWidth="0.8" strokeDasharray="2 1" />
                              </g>
                            )}
                          </>
                        )}
                      </svg>
                    </div>

                    {/* Scope metadata stats */}
                    <div className="flex-1 w-full font-mono text-[9.5px] space-y-1 text-slate-350 text-left">
                      <div className="flex justify-between border-b border-white/5 pb-1 select-none">
                        <span className="text-slate-500 font-bold">RWR STATE:</span>
                        <span className={`font-black tracking-tight ${
                          resolvedRwrStage === "search" ? "text-emerald-400" :
                          resolvedRwrStage === "track" ? "text-amber-400" :
                          resolvedRwrStage === "lock" ? "text-orange-400" :
                          "text-red-500 animate-pulse font-black"
                        }`}>
                          {resolvedRwrStage.toUpperCase()} {resolvedRwrStage === "missile" ? "LAUNCH ⚠️" : "DETECTED"}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5 text-[8.5px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">CABIN HUM:</span>
                          <span className="text-sky-400 font-medium">45Hz / COCKPIT-RUMBLE</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">RF INTERFERENCE:</span>
                          <span className="text-sky-400 font-medium">1.55kHz MOD(2.8Hz)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">PULSE SPEED:</span>
                          <span className="text-sky-400 font-medium">
                            {resolvedRwrStage === "search" ? "CHIRP GRP (1.8s)" :
                             resolvedRwrStage === "track" ? "TACTICAL DET (2.2Hz)" :
                             resolvedRwrStage === "lock" ? "HARD LOCK (6.6Hz)" :
                             "WARBLE (14Hz) / GATE(11Hz)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Warning Alert Text Input */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {lang === "ar" ? "نص رسالة البث الجوي المخصصة" : "CUSTOM BROADCAST WARNING MSG"}
                </label>

                {/* Live sound playing label */}
                {isSpeaking && (
                  <span className="text-[9px] font-mono font-black text-rose-500 flex items-center gap-1 animate-pulse">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    {lang === "ar" ? "جاري البث الصوتي الفوري..." : "XMITTING VOICE CORRIDOR..."}
                  </span>
                )}
              </div>

              <textarea
                value={customAlertMsg}
                onChange={(e) => {
                  setCustomAlertMsg(e.target.value);
                  setHasUserEditedMsg(true);
                }}
                rows={2}
                className={`w-full p-3 rounded-xl text-xs font-semibold outline-none transition-all ${
                  isLight
                    ? "bg-slate-50 border border-slate-200 text-slate-800 focus:border-slate-400 placeholder-slate-400"
                    : "bg-slate-950/70 border border-white/10 text-slate-150 focus:border-rose-500/40 placeholder-slate-600"
                }`}
                placeholder={lang === "ar" ? "أدخل بيان الطوارئ للبث الفوري..." : "Type custom emergency alert broadcast..."}
              />

              {/* Dedicated Voice Alarm Trigger Button with Visualized Sound Wavebars */}
              <div className="mt-2.5 flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-950/40 border border-white/5">
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <button
                      type="button"
                      onClick={stopEmergencyBroadcastAndSpeech}
                      className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 cursor-pointer transition-all flex items-center gap-1 text-[10px] uppercase font-mono font-extrabold"
                      title={lang === "ar" ? "إيقاف البث" : "Stop Broadcast"}
                    >
                      <Square className="w-3 h-3 fill-rose-500 animate-pulse" />
                      {lang === "ar" ? "إيقاف النداء" : "Stop Voice"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => playEmergencyBroadcastAndSpeech()}
                      className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/20 text-sky-450 hover:text-sky-350 cursor-pointer transition-all flex items-center gap-1.5 text-[10px] uppercase font-mono font-extrabold"
                      title={lang === "ar" ? "بث النداء الصوتي الفوري" : "Broadcast voice transmission now"}
                    >
                      <Play className="w-3 h-3 fill-sky-400" />
                      {lang === "ar" ? "بث نداء الطوارئ الجوي والفوري [صوت + إنذار]" : "Broadcast Emergency Alert [Voice + Siren]"}
                    </button>
                  )}
                </div>

                {/* Simulated equalizer sound bar animations */}
                <div className="flex items-end gap-1 px-2 h-4 overflow-hidden">
                  <div className={`w-0.5 bg-sky-400 rounded-full transition-all duration-150 ${isSpeaking ? "animate-bounce h-3" : "h-1"}`} style={{ animationDelay: "0ms" }}></div>
                  <div className={`w-0.5 bg-rose-400 rounded-full transition-all duration-150 ${isSpeaking ? "animate-bounce h-4" : "h-1"}`} style={{ animationDelay: "150ms", animationDuration: "0.6s" }}></div>
                  <div className={`w-0.5 bg-sky-400 rounded-full transition-all duration-150 ${isSpeaking ? "animate-bounce h-2" : "h-1"}`} style={{ animationDelay: "300ms", animationDuration: "0.4s" }}></div>
                  <div className={`w-0.5 bg-sky-400 rounded-full transition-all duration-150 ${isSpeaking ? "animate-bounce h-4.5" : "h-1"}`} style={{ animationDelay: "100ms", animationDuration: "0.75s" }}></div>
                  <div className={`w-0.5 bg-rose-400 rounded-full transition-all duration-150 ${isSpeaking ? "animate-bounce h-3" : "h-1"}`} style={{ animationDelay: "200ms" }}></div>
                </div>
              </div>

              {/* Sound Source Attribution requested by the user */}
              <div className="mt-2.5 p-2 rounded-xl bg-slate-950/20 border border-white/5 text-[9px] font-mono text-slate-400 flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-rose-500 animate-pulse" />
                  {lang === "ar" ? "مصدر الصوت:" : "SIREN EFFECT:"}
                </span>
                <span className="text-right tracking-tight text-slate-350" dangerouslySetInnerHTML={{
                  __html: 'Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=7010" target="_blank" rel="noopener noreferrer" class="text-rose-550 hover:text-rose-450 font-bold transition-all underline">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=7010" target="_blank" rel="noopener noreferrer" class="text-rose-550 hover:text-rose-450 font-bold transition-all underline">Pixabay</a>'
                }} />
              </div>
            </div>



            {/* Status flashing message */}
            {showNotification && (
              <div className="bg-sky-500/15 border border-sky-400/40 p-3 rounded-xl mb-4 text-xs text-sky-900 dark:text-sky-200 font-semibold animate-pulse flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>{showNotification}</span>
              </div>
            )}

            {/* Huge central flashing trigger alert button */}
            <button
              onClick={handleTriggerAlarm}
              className={`w-full py-4 px-6 rounded-2xl font-black text-center flex flex-col items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                isAlarmActive 
                  ? "bg-rose-500 text-slate-950 scale-95 shadow-rose-500/30 animate-pulse" 
                  : isLight 
                    ? "bg-rose-50/50 border border-rose-300 text-rose-600 hover:bg-rose-50" 
                    : "bg-slate-900 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              <AlertTriangle className={`w-10 h-10 mb-2 ${isAlarmActive ? "animate-bounce" : ""}`} />
              <span className="text-sm font-bold block">
                {isAlarmActive ? t.deactivateAlarm : t.triggerAlarm}
              </span>
              <span className="text-[9px] opacity-70 block font-mono font-bold mt-1">
                {isAlarmActive ? "DEACTIVATE RED EMERGENCY OVERLAY" : "AMPLIFY EMERGENCY SATELLITE SIREN"}
              </span>
            </button>

            {/* Simulated Live broadcast channels data stream */}
            {isAlarmActive && (
              <div className={`mt-4 p-3 rounded-xl font-mono text-[9.5px] border ${
                isLight 
                  ? "bg-red-50 border-red-200 text-red-700" 
                  : "bg-rose-950/20 border-rose-500/20 text-rose-300"
              } animate-pulse`}>
                <span className="block font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  ● TRANSMITTER ACTIVE CH-16 (156.8 MHz)
                </span>
                <span className="block mt-1 whitespace-pre-wrap opacity-90">
                  {lang === "ar" ? "بيان البث الترددي النشط للغارة: " : "XMIT PROTOCOL LOG: "}"{customAlertMsg}"
                </span>
              </div>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-400 border-t border-white/5 pt-3 mt-4 text-center">
            ALERT FREQ CHANNELS: 156.8 MHz (VHF Ch 16)
          </div>
        </div>

        {/* Secure Air Intelligence Intelligence Report Download block */}
        <div className={`p-6 rounded-2xl border flex flex-col justify-between h-full min-h-[320px] transition-all ${
          isLight 
            ? "bg-white border-slate-200/80 shadow-[0_4px_15px_rgba(148,163,184,0.05)] text-slate-800" 
            : "glass-card border-sky-500/10 text-slate-100"
        }`}>
          <div>
            <h4 className={`text-xs font-black uppercase tracking-widest border-b pb-3 mb-4 flex items-center gap-1.5 ${
              isLight ? "text-sky-600 border-slate-100" : "text-sky-400 border-white/5"
            }`}>
              <Download className="w-4 h-4 text-sky-500 shrink-0" />
              {t.exportReport}
            </h4>
            <p className={`text-xs leading-relaxed mb-6 ${isLight ? "text-slate-600" : "text-slate-350"}`}>
              {t.exportDesc}
            </p>
          </div>

          <div>
            <button
              onClick={handleDownloadReport}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-black shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Download className="w-4 h-4" />
              {t.downloadIntelReport}
            </button>
            <div className={`text-[10px] font-mono mt-4 text-center ${isLight ? "text-slate-400" : "text-slate-500"}`}>
              {t.secureSha256}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
