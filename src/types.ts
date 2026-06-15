/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Aircraft {
  ymin: number; // Scale: 0 to 1000
  xmin: number;
  ymax: number;
  xmax: number;
  aircraftName: string;
  aircraftType: "Military" | "Civilian" | "Cargo" | "Private" | "Helicopter" | "Drone" | string;
  confidence: number; // 0.0 to 1.0
  descriptionAr: string;
  classId?: number;   // YOLO class ID (only present for YOLO detections)
  rawClass?: string;  // Raw YOLO class name (e.g. "drone", "airplane")
}

export interface DetectionResult {
  totalCount: number;
  summaryAr: string;
  aircrafts: Aircraft[];
  detectionSource?: "yolo" | "gemini" | "mock"; // Which AI model was used
  modelClasses?: string[]; // YOLO model class names (only present for YOLO detections)
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
  classes?: Record<number, string>;
  message?: string;
}
