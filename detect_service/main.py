"""
Intelligent Aircraft Detection System - YOLOv8 Detection Microservice
FastAPI service that loads best.pt and runs inference on uploaded images/video frames.
All detected objects are enriched with data from aircraft_info.json.
"""

import os
import io
import base64
import json
import logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ultralytics import YOLO

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yolo-detect-service")

# ─── App Setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="YOLOv8 Aircraft Detection API",
    description="Runs the trained best.pt YOLOv8 model for aircraft/drone detection. Enriches results from aircraft_info.json.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Paths (relative to this file so it's portable) ──────────────────────────
SERVICE_DIR = Path(__file__).parent
MODEL_PATH  = SERVICE_DIR / "best.pt"
DB_PATH     = SERVICE_DIR / "aircraft_info.json"

# ─── Global state ────────────────────────────────────────────────────────────
model: Optional[YOLO] = None
class_names: dict = {}
AIRCRAFT_DB: dict = {}   # keyed by lowercase class_name


# ─── Startup: load model + aircraft DB ───────────────────────────────────────
@app.on_event("startup")
async def load_model():
    global model, class_names, AIRCRAFT_DB

    # 1. Load YOLOv8 model
    if not MODEL_PATH.exists():
        logger.error(f"Model file not found at {MODEL_PATH}")
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")

    logger.info(f"Loading YOLOv8 model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    class_names = model.names  # {0: 'A10', 1: 'F16', ...}
    logger.info(f"Model loaded. {len(class_names)} classes: {list(class_names.values())}")

    # 2. Load Aircraft Intelligence Database
    if DB_PATH.exists():
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                cls_name = item.get("class_name", "").lower().strip()
                if cls_name:
                    AIRCRAFT_DB[cls_name] = item
            logger.info(f"Aircraft DB loaded: {len(AIRCRAFT_DB)} profiles.")
        except Exception as e:
            logger.error(f"Failed to load aircraft DB: {e}")
    else:
        logger.warning(f"Aircraft DB not found at {DB_PATH}. Detections will use fallback descriptions.")


# ─── Helper: look up DB entry for a YOLO class name ──────────────────────────
def get_db_entry(class_name: str) -> Optional[dict]:
    """Return the aircraft_info.json entry for this YOLO class name, or None."""
    return AIRCRAFT_DB.get(class_name.lower().strip())


def get_aircraft_type(class_name: str, db_entry: Optional[dict]) -> str:
    if db_entry:
        cat = db_entry.get("category", "").lower()
        if any(k in cat for k in ["military", "attack", "fighter", "bomber", "interceptor",
                                   "trainer", "transport", "airlifter", "patrol", "helicopter",
                                   "stovl", "drone", "uav"]):
            if "helicopter" in cat:
                return "Helicopter"
            if "drone" in cat or "uav" in cat:
                return "Drone"
            if "transport" in cat or "airlifter" in cat or "cargo" in cat:
                return "Cargo"
            return "Military"
        if any(k in cat for k in ["civilian", "commercial", "private"]):
            return "Civilian"
        return db_entry.get("category", "Unknown")
    # Fallback heuristic
    lower = class_name.lower()
    if any(k in lower for k in ["drone", "uav", "mq", "rq"]):
        return "Drone"
    return "Military"


def get_display_name(class_name: str, db_entry: Optional[dict]) -> str:
    if db_entry:
        return db_entry.get("full_name", class_name.upper())
    return class_name.replace("_", " ").title()


def build_aircraft_payload(class_name: str, db_entry: Optional[dict]) -> dict:
    """Build the enriched aircraft info fields to attach to every detection."""
    if not db_entry:
        return {
            "aircraftName": get_display_name(class_name, None),
            "aircraftType": get_aircraft_type(class_name, None),
            "descriptionAr": (
                f"Aircraft classification: {class_name.upper()}. "
                "No detailed profile found in intelligence database. "
                "Assess threat level based on flight trajectory and radar signature."
            ),
            "country": None,
            "manufacturer": None,
            "first_flight": None,
            "crew": None,
            "max_speed": None,
            "range": None,
            "primary_roles": [],
            "recognition_features": [],
            "strengths": [],
            "weaknesses": [],
        }

    description = db_entry.get("description", "")
    return {
        "aircraftName": db_entry.get("full_name", class_name.upper()),
        "aircraftType": get_aircraft_type(class_name, db_entry),
        "descriptionAr": description,
        # ── Rich Intel Fields ──────────────────────────────────────────────
        "country":              db_entry.get("country"),
        "manufacturer":         db_entry.get("manufacturer"),
        "first_flight":         db_entry.get("first_flight"),
        "crew":                 db_entry.get("crew"),
        "max_speed":            db_entry.get("max_speed"),
        "range":                db_entry.get("range"),
        "primary_roles":        db_entry.get("primary_roles", []),
        "recognition_features": db_entry.get("recognition_features", []),
        "strengths":            db_entry.get("strengths", []),
        "weaknesses":           db_entry.get("weaknesses", []),
    }


# ─── Core: convert YOLO results → DetectionResult JSON ───────────────────────
def yolo_results_to_json(results, img_w: int, img_h: int) -> dict:
    """
    Convert raw YOLO results to the DetectionResult schema.
    Coordinates are scaled to 0–1000 to match the frontend bounding box system.
    Each aircraft is enriched with full data from aircraft_info.json.
    """
    aircrafts = []

    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue

        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
            conf     = float(box.conf[0].cpu().numpy())
            cls_id   = int(box.cls[0].cpu().numpy())
            cls_name = class_names.get(cls_id, f"class_{cls_id}")

            # Scale pixel coords to 0–1000
            xmin = max(0, min(1000, round((x1 / img_w) * 1000)))
            ymin = max(0, min(1000, round((y1 / img_h) * 1000)))
            xmax = max(0, min(1000, round((x2 / img_w) * 1000)))
            ymax = max(0, min(1000, round((y2 / img_h) * 1000)))

            db_entry = get_db_entry(cls_name)
            payload  = build_aircraft_payload(cls_name, db_entry)

            aircrafts.append({
                # Bounding box (0–1000 scale)
                "xmin": xmin,
                "ymin": ymin,
                "xmax": xmax,
                "ymax": ymax,
                # YOLO metadata
                "confidence": round(conf, 4),
                "classId":    cls_id,
                "rawClass":   cls_name,
                # Enriched fields from aircraft_info.json
                **payload,
            })

    # Sort highest confidence first
    aircrafts.sort(key=lambda x: x["confidence"], reverse=True)

    # Build executive summary
    total = len(aircrafts)
    if total == 0:
        summary = "No aerial objects detected in the submitted imagery. Airspace appears clear within sensor range."
    else:
        military = sum(1 for a in aircrafts if "military" in a["aircraftType"].lower())
        drones   = sum(1 for a in aircrafts if "drone" in a["aircraftType"].lower())
        names    = ", ".join(a["aircraftName"] for a in aircrafts[:3])
        summary  = f"YOLOv8 detection complete — {total} aerial object(s) identified: {names}."
        if total > 3:
            summary += f" (+{total - 3} more)"
        if military:
            summary += f" {military} military-grade aircraft on radar — threat assessment required."
        if drones:
            summary += f" {drones} UAV/Drone signature(s) detected — airspace alert recommended."
        summary += " All detections produced by trained surveillance neural network."

    return {
        "totalCount":    total,
        "summaryAr":     summary,
        "aircrafts":     aircrafts,
        "detectionSource": "yolo",
        "modelClasses":  list(class_names.values()),
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status":       "online",
        "model_loaded": model is not None,
        "model_path":   str(MODEL_PATH),
        "db_profiles":  len(AIRCRAFT_DB),
        "classes":      class_names,
    }


@app.post("/detect-image")
async def detect_image(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.3),
):
    """Run YOLOv8 on an uploaded image file."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    try:
        image_bytes = await file.read()
        image_pil   = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = image_pil.size
        logger.info(f"[detect-image] {img_w}x{img_h}, conf={confidence}")

        results = model.predict(source=image_pil, conf=confidence, verbose=False, save=False)
        response_data = yolo_results_to_json(results, img_w, img_h)
        logger.info(f"[detect-image] {response_data['totalCount']} objects found")
        return JSONResponse(content=response_data)
    except Exception as e:
        logger.error(f"[detect-image] failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect-frame")
async def detect_frame(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.25),
):
    """Run YOLOv8 on a single video frame (JPEG bytes). Optimized for rapid frame calls."""
    return await detect_image(file=file, confidence=confidence)


class Base64ImageRequest(BaseModel):
    image:      str
    mimeType:   str   = "image/jpeg"
    confidence: float = 0.3


@app.post("/detect-base64")
async def detect_base64(req: Base64ImageRequest):
    """Run YOLOv8 on a base64-encoded image. Used by the web frontend."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    try:
        image_bytes = base64.b64decode(req.image)
        image_pil   = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = image_pil.size
        logger.info(f"[detect-base64] {img_w}x{img_h}, conf={req.confidence}")

        results = model.predict(source=image_pil, conf=req.confidence, verbose=False, save=False)
        response_data = yolo_results_to_json(results, img_w, img_h)
        logger.info(f"[detect-base64] {response_data['totalCount']} objects found")
        return JSONResponse(content=response_data)
    except Exception as e:
        logger.error(f"[detect-base64] failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=False)
