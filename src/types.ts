/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Aircraft {
  // ── Bounding box (0–1000 scale) ──────────────────────────────────────────
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;

  // ── Core detection ────────────────────────────────────────────────────────
  aircraftName: string;
  aircraftType: "Military" | "Civilian" | "Cargo" | "Private" | "Helicopter" | "Drone" | string;
  confidence: number;   // 0.0 to 1.0
  descriptionAr: string;

  // ── YOLO metadata (only present for YOLO detections) ─────────────────────
  classId?: number;
  rawClass?: string;

  // ── Rich intelligence fields from aircraft_info.json ─────────────────────
  country?:               string;
  manufacturer?:          string;
  first_flight?:          string;
  crew?:                  string;
  max_speed?:             string;
  range?:                 string;
  primary_roles?:         string[];
  recognition_features?:  string[];
  strengths?:             string[];
  weaknesses?:            string[];
}

export interface DetectionResult {
  totalCount: number;
  summaryAr: string;
  aircrafts: Aircraft[];
  detectionSource?: "yolo" | "gemini" | "mock";
  modelClasses?: string[];
}

export type TabType = "image" | "video" | "threat";

export type DetectionMode = "yolo" | "gemini";

export interface RadarLog {
  id: string;
  timestamp: string;
  fileName: string;
  status: "completed" | "failed" | "scanning";
  aircraftDetected: number;
  highestThreat?: string;
  imageUrl?: string;
  result?: DetectionResult;
  detectionMode?: DetectionMode;
}

export interface SystemMetrics {
  online: boolean;
  temperature: number;
  pingMs: number;
  scansPerformed: number;
  threatScore: number; // 0 to 100
  gpsCoords: string;
}

export interface YoloServiceStatus {
  online: boolean;
  model_loaded?: boolean;
  db_profiles?: number;
  classes?: Record<number, string>;
  message?: string;
}
