"""
Intelligent Aircraft Detection System - YOLOv8 Detection Microservice
FastAPI service that loads best.pt and runs inference on uploaded images/video frames.
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
    description="Runs the trained best.pt YOLOv8 model for aircraft/drone/bird detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Model Loading ───────────────────────────────────────────────────────────
MODEL_PATH = Path(r"d:\digilians\graduation project\final project\best (2).pt")
model: Optional[YOLO] = None
class_names: dict = {}

# Aircraft type mapping — based on actual model classes
AIRCRAFT_TYPE_MAP = {
    # Attack / Fighter
    "A10": "Military",
    "AV8B": "Military",
    "F117": "Military",
    "F14": "Military",
    "F15": "Military",
    "F16": "Military",
    "F18": "Military",
    "F22": "Military",
    "F35": "Military",
    "F4": "Military",
    "EF2000": "Military",
    "JAS39": "Military",
    "JF17": "Military",
    "Rafale": "Military",
    "Mirage2000": "Military",
    "Mig29": "Military",
    "Mig31": "Military",
    "Su24": "Military",
    "Su25": "Military",
    "Su34": "Military",
    "Su57": "Military",
    "J10": "Military",
    "J20": "Military",
    "JH7": "Military",
    "T50": "Military",
    "Tornado": "Military",
    # Bombers
    "B1": "Military",
    "B2": "Military",
    "B52": "Military",
    "Tu160": "Military",
    "Tu22M": "Military",
    "Tu95": "Military",
    "H6": "Military",
    # Transport / Cargo
    "A400M": "Cargo",
    "An124": "Cargo",
    "C130": "Cargo",
    "C17": "Cargo",
    "C5": "Cargo",
    "C390": "Cargo",
    "Il76": "Cargo",
    "KC135": "Cargo",
    "Y20": "Cargo",
    "C1": "Cargo",
    "C2": "Cargo",
    # Reconnaissance / ISR
    "U2": "Military",
    "SR71": "Military",
    "P3": "Military",
    "E2": "Military",
    "E7": "Military",
    "RQ4": "Drone",
    "MQ9": "Drone",
    "TB2": "Drone",
    # Helicopters
    "AH64": "Helicopter",
    "CH47": "Helicopter",
    "Ka52": "Helicopter",
    "Mi24": "Helicopter",
    "Mi28": "Helicopter",
    "Mi8": "Helicopter",
    "UH60": "Helicopter",
    # Amphibious / Special
    "AG600": "Civilian",
    "Be200": "Civilian",
    "CL415": "Civilian",
    "US2": "Civilian",
    # Multi-role
    "EMB314": "Military",
    "V22": "Military",
    "Vulcan": "Military",
    # Drone
    "drone": "Drone",
}

# Friendly display names
DISPLAY_NAME_MAP = {
    "A10": "A-10 Thunderbolt II",
    "A400M": "Airbus A400M Atlas",
    "AG600": "AVIC AG600 Amphibious",
    "AH64": "Boeing AH-64 Apache",
    "AV8B": "McDonnell Douglas AV-8B Harrier II",
    "An124": "Antonov An-124 Ruslan",
    "B1": "Rockwell B-1 Lancer",
    "B2": "Northrop B-2 Spirit",
    "B52": "Boeing B-52 Stratofortress",
    "Be200": "Beriev Be-200 Altair",
    "C1": "NAMC C-1 Transport",
    "C130": "Lockheed C-130 Hercules",
    "C17": "Boeing C-17 Globemaster III",
    "C2": "Grumman C-2 Greyhound",
    "C390": "Embraer C-390 Millennium",
    "C5": "Lockheed C-5 Galaxy",
    "CH47": "Boeing CH-47 Chinook",
    "CL415": "Bombardier CL-415 Superscooper",
    "E2": "Northrop Grumman E-2 Hawkeye",
    "E7": "Boeing E-7A Wedgetail",
    "EF2000": "Eurofighter Typhoon",
    "EMB314": "Embraer EMB-314 Super Tucano",
    "F117": "Lockheed F-117 Nighthawk",
    "F14": "Grumman F-14 Tomcat",
    "F15": "McDonnell Douglas F-15 Eagle",
    "F16": "General Dynamics F-16 Fighting Falcon",
    "F18": "Boeing F/A-18 Super Hornet",
    "F22": "Lockheed F-22 Raptor",
    "F35": "Lockheed F-35 Lightning II",
    "F4": "McDonnell Douglas F-4 Phantom II",
    "H6": "Xi'an H-6 Bomber",
    "Il76": "Ilyushin Il-76 Candid",
    "J10": "Chengdu J-10 Vigorous Dragon",
    "J20": "Chengdu J-20 Mighty Dragon",
    "JAS39": "Saab JAS-39 Gripen",
    "JF17": "JF-17 Thunder",
    "JH7": "Xi'an JH-7 Flounder",
    "KC135": "Boeing KC-135 Stratotanker",
    "Ka52": "Kamov Ka-52 Alligator",
    "MQ9": "MQ-9 Reaper UAV",
    "Mi24": "Mil Mi-24 Hind",
    "Mi28": "Mil Mi-28 Havoc",
    "Mi8": "Mil Mi-8 Hip",
    "Mig29": "Mikoyan MiG-29 Fulcrum",
    "Mig31": "Mikoyan MiG-31 Foxhound",
    "Mirage2000": "Dassault Mirage 2000",
    "P3": "Lockheed P-3 Orion",
    "RQ4": "Northrop RQ-4 Global Hawk",
    "Rafale": "Dassault Rafale",
    "SR71": "Lockheed SR-71 Blackbird",
    "Su24": "Sukhoi Su-24 Fencer",
    "Su25": "Sukhoi Su-25 Frogfoot",
    "Su34": "Sukhoi Su-34 Fullback",
    "Su57": "Sukhoi Su-57 Felon",
    "T50": "Sukhoi T-50 PAK-FA",
    "TB2": "Bayraktar TB2 UCAV",
    "Tornado": "Panavia Tornado",
    "Tu160": "Tupolev Tu-160 Blackjack",
    "Tu22M": "Tupolev Tu-22M Backfire",
    "Tu95": "Tupolev Tu-95 Bear",
    "U2": "Lockheed U-2 Dragon Lady",
    "UH60": "Sikorsky UH-60 Black Hawk",
    "US2": "ShinMaywa US-2 Amphibious",
    "V22": "Bell-Boeing V-22 Osprey",
    "Vulcan": "Avro Vulcan",
    "Y20": "Xi'an Y-20 Kunpeng",
    "drone": "UAV / Drone",
}

# Description templates per class
DESCRIPTION_MAP = {
    "A10": "A-10 Thunderbolt II attack aircraft detected. Known as 'Warthog', armed with 30mm GAU-8 Avenger rotary cannon. Primary close air support mission profile.",
    "F117": "F-117 Nighthawk stealth attack aircraft detected. World's first operational stealth aircraft. Angular faceted fuselage design for reduced radar cross-section.",
    "F22": "F-22 Raptor fifth-generation air superiority fighter detected. Combined supercruise, stealth, and thrust vectoring make it the most advanced fighter in service.",
    "F35": "F-35 Lightning II multirole stealth fighter detected. Advanced sensor fusion, AESA radar, and all-aspect low-observable airframe identified.",
    "B2": "B-2 Spirit stealth strategic bomber detected. Flying-wing design with low-observable coating. Capable of nuclear payload delivery — extreme threat level.",
    "B52": "B-52 Stratofortress strategic bomber detected. Long-range heavy bomber with 8 turbofan engines and nuclear/conventional munitions capability.",
    "Tu160": "Tu-160 Blackjack supersonic strategic bomber detected. Largest combat aircraft ever built. Variable-sweep wing design for Mach 2+ capability.",
    "J20": "Chengdu J-20 fifth-generation stealth fighter detected. Chinese air superiority fighter with advanced avionics and internal weapons bay.",
    "Su57": "Su-57 Felon fifth-generation multirole fighter detected. Russian stealth fighter with supercruise and advanced electronic warfare systems.",
    "MQ9": "MQ-9 Reaper armed UAV detected. Long-endurance hunter-killer drone capable of precision strike with Hellfire missiles and laser-guided bombs.",
    "RQ4": "RQ-4 Global Hawk HALE UAV detected. High-altitude long-endurance reconnaissance drone with synthetic aperture radar and EO/IR sensors.",
    "TB2": "Bayraktar TB2 UCAV detected. Turkish combat drone with laser-guided munitions. Proven in multiple conflict zones. Medium-altitude profile detected.",
    "AH64": "AH-64 Apache attack helicopter detected. Twin-engine tandem-seat attack helicopter with Longbow radar, Hellfire missiles, and 30mm M230 chain gun.",
    "drone": "Generic UAV/Drone detected. Unidentified unmanned aerial vehicle with small radar cross-section. Potential surveillance or combat payload — assess immediately.",
}


@app.on_event("startup")
async def load_model():
    """Load the YOLOv8 model on startup."""
    global model, class_names
    if not MODEL_PATH.exists():
        logger.error(f"Model file not found at {MODEL_PATH}")
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")

    logger.info(f"Loading YOLOv8 model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    # Extract class names from the model
    class_names = model.names  # dict: {0: 'airplane', 1: 'drone', ...}
    logger.info(f"Model loaded. Classes: {class_names}")


def get_aircraft_type(class_name: str) -> str:
    """Map a YOLO class name to an aircraft type category."""
    lower = class_name.lower()
    for key, atype in AIRCRAFT_TYPE_MAP.items():
        if key in lower:
            return atype
    return "Civilian"


def get_display_name(class_name: str) -> str:
    """Get a friendly display name for a class."""
    lower = class_name.lower()
    return DISPLAY_NAME_MAP.get(lower, class_name.replace("_", " ").title())


def get_description(class_name: str) -> str:
    """Get a technical description for a class."""
    lower = class_name.lower()
    return DESCRIPTION_MAP.get(
        lower,
        f"{class_name.title()} detected by YOLOv8 surveillance model with high confidence. "
        f"Object profile and bounding geometry extracted from aerial imagery analysis."
    )


def yolo_results_to_json(results, img_w: int, img_h: int) -> dict:
    """
    Convert YOLO results to the DetectionResult schema used by the web app.
    Coordinates are scaled to 0–1000 range to match existing frontend format.
    """
    aircrafts = []

    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue

        for box in boxes:
            # Get bounding box in pixel coords (xyxy format)
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
            conf = float(box.conf[0].cpu().numpy())
            cls_id = int(box.cls[0].cpu().numpy())
            class_name = class_names.get(cls_id, f"class_{cls_id}")

            # Scale to 0–1000 range
            xmin = round((x1 / img_w) * 1000)
            ymin = round((y1 / img_h) * 1000)
            xmax = round((x2 / img_w) * 1000)
            ymax = round((y2 / img_h) * 1000)

            # Clamp to valid range
            xmin = max(0, min(1000, xmin))
            ymin = max(0, min(1000, ymin))
            xmax = max(0, min(1000, xmax))
            ymax = max(0, min(1000, ymax))

            aircrafts.append({
                "xmin": xmin,
                "ymin": ymin,
                "xmax": xmax,
                "ymax": ymax,
                "aircraftName": get_display_name(class_name),
                "aircraftType": get_aircraft_type(class_name),
                "confidence": round(conf, 4),
                "descriptionAr": get_description(class_name),
                "classId": cls_id,
                "rawClass": class_name,
            })

    # Sort by confidence descending
    aircrafts.sort(key=lambda x: x["confidence"], reverse=True)

    # Build summary
    total = len(aircrafts)
    if total == 0:
        summary = "No aerial objects detected in the submitted image. The airspace appears clear within sensor range."
    elif total == 1:
        obj = aircrafts[0]
        summary = (
            f"YOLOv8 detection complete. 1 object identified: {obj['aircraftName']} "
            f"({obj['aircraftType']}) with {round(obj['confidence'] * 100, 1)}% confidence. "
            f"Bounding coordinates extracted from trained model inference."
        )
    else:
        types = [a["aircraftType"] for a in aircrafts]
        military_count = types.count("Military")
        drone_count = types.count("Drone")
        summary = (
            f"YOLOv8 detection complete. {total} aerial objects detected in frame. "
        )
        if military_count:
            summary += f"{military_count} military-grade aircraft identified. "
        if drone_count:
            summary += f"{drone_count} UAV/Drone signature(s) detected — airspace alert recommended. "
        summary += "All detections extracted by trained surveillance neural network."

    return {
        "totalCount": total,
        "summaryAr": summary,
        "aircrafts": aircrafts,
        "detectionSource": "yolo",
        "modelClasses": list(class_names.values()),
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Check if the service and model are loaded."""
    return {
        "status": "online",
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH),
        "classes": class_names,
    }


@app.post("/detect-image")
async def detect_image(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.3),
):
    """
    Run YOLOv8 detection on an uploaded image.
    Returns DetectionResult JSON matching the web app schema.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Check server startup logs.")

    try:
        # Read and decode image
        image_bytes = await file.read()
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = image_pil.size

        logger.info(f"Running inference on image {img_w}x{img_h}, conf_threshold={confidence}")

        # Run YOLO inference
        results = model.predict(
            source=image_pil,
            conf=confidence,
            verbose=False,
            save=False,
        )

        response_data = yolo_results_to_json(results, img_w, img_h)
        logger.info(f"Detection complete: {response_data['totalCount']} objects found")
        return JSONResponse(content=response_data)

    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@app.post("/detect-frame")
async def detect_frame(
    file: UploadFile = File(...),
    confidence: float = Form(default=0.3),
):
    """
    Run YOLOv8 detection on a single video frame (JPEG bytes).
    Same as detect-image but optimized for rapid frame-by-frame calls.
    """
    return await detect_image(file=file, confidence=confidence)


class Base64ImageRequest(BaseModel):
    image: str          # base64 encoded image data
    mimeType: str = "image/jpeg"
    confidence: float = 0.3


@app.post("/detect-base64")
async def detect_base64(req: Base64ImageRequest):
    """
    Run YOLOv8 detection on a base64-encoded image.
    Used when the frontend passes base64 image data directly.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    try:
        # Decode base64 → bytes → PIL Image
        image_bytes = base64.b64decode(req.image)
        image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = image_pil.size

        logger.info(f"Running base64 inference on {img_w}x{img_h}, conf={req.confidence}")

        results = model.predict(
            source=image_pil,
            conf=req.confidence,
            verbose=False,
            save=False,
        )

        response_data = yolo_results_to_json(results, img_w, img_h)
        logger.info(f"Base64 detection: {response_data['totalCount']} objects")
        return JSONResponse(content=response_data)

    except Exception as e:
        logger.error(f"Base64 detection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=False)
