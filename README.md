# Intelligent Aircraft Detection System — YOLO Integration Guide

## Overview

This system combines:
- **YOLOv8 local model** (`best.pt`) — runs on your machine, real-time detection
- **Gemini AI** — cloud-based analysis with rich descriptions  
- **React + Vite** frontend — beautiful HUD interface

---

## How to Run

### Step 1: Start the YOLOv11 Python Service

```bash
# Double-click OR run in terminal:
detect_service\start_service.bat
```

This will:
1. Create a Python virtual environment
2. Install all dependencies automatically
3. Load `best.pt` model
4. Start the service at **http://localhost:5001**

### Step 2: Start the Web App

```bash
npm install
npm run dev
```

The web app will be available at **http://localhost:3000**

---

## Usage

### Image Detection
1. Open the web app
2. Make sure the **model toggle** at the top shows `🤖 YOLOv8 LOCAL MODEL — SERVICE ONLINE`
3. Upload any image (JPG, PNG, WEBP) or click one of the preset feeds
4. The real YOLOv8 model will detect objects and draw bounding boxes

### Video Detection
1. Switch to the **Video** tab
2. Click **Upload Video (MP4)**
3. The model will analyze frames every 2 seconds and draw real bounding boxes on detected objects

### Switch to Gemini AI
If the YOLO service is offline, click `✨ Gemini AI` in the model toggle to use Gemini instead.

---

## Architecture

```
Browser (React) 
    │
    │ POST /api/yolo-detect (base64 image)
    ▼
Express Server (Node.js, port 3000)
    │
    │ POST http://localhost:5001/detect-base64
    ▼
Python FastAPI (port 5001)
    │
    │ model.predict(image)
    ▼
YOLOv8 (best.pt)
    │
    ▼
Bounding Boxes + Class Names + Confidence Scores
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/yolo-detect` | POST | Run YOLO on uploaded image |
| `/api/yolo-detect-frame` | POST | Run YOLO on single video frame |
| `/api/yolo-health` | GET | Check if Python service is online |
| `/api/detect` | POST | Run Gemini AI analysis |
| `http://localhost:5001/health` | GET | Python service health + model info |
| `http://localhost:5001/detect-base64` | POST | Direct YOLO inference endpoint |

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
YOLO_SERVICE_URL=http://localhost:5001
```

---

## Azure Deployment

### Option 1: Docker (Recommended)
Create two Docker containers:
- **Web container**: Node.js (serves the React app + Express)
- **YOLO container**: Python (FastAPI + YOLOv8)

### Option 2: Azure Container Apps
Deploy both services to Azure Container Apps with internal networking.

The `YOLO_SERVICE_URL` environment variable should point to the internal URL of the Python container.
