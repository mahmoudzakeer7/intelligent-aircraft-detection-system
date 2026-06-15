import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import FormData from "form-data";
import fetch from "node-fetch";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// YOLOv8 Python microservice URL
const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || "http://localhost:5001";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limits for large base64 aerial imagery uploads
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // Initialize Gemini SDK with telemetry User-Agent
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API initialized successfully in full-stack mode.");
  } else {
    console.warn("GEMINI_API_KEY is not defined. Application will operate with highly realistic mock intelligence.");
  }

  // ─── YOLOv8 Health Check Proxy ────────────────────────────────────────────
  app.get("/api/yolo-health", async (req, res) => {
    try {
      const response = await fetch(`${YOLO_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      return res.json({ online: true, ...data });
    } catch {
      return res.json({ online: false, message: "YOLOv8 service offline" });
    }
  });

  // ─── YOLOv8 Image Detection ────────────────────────────────────────────────
  app.post("/api/yolo-detect", async (req, res) => {
    try {
      const { image, mimeType, confidence } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image data provided." });
      }

      // Check if YOLO service is available
      let yoloOnline = false;
      try {
        const healthCheck = await fetch(`${YOLO_SERVICE_URL}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        yoloOnline = healthCheck.ok;
      } catch {
        yoloOnline = false;
      }

      if (!yoloOnline) {
        console.warn("[YOLO] Python service offline — returning offline status");
        return res.status(503).json({
          error: "YOLOv8 service is offline. Please start detect_service/start_service.bat first.",
          yoloOffline: true,
        });
      }

      // Forward base64 image to Python service /detect-base64
      const yoloResponse = await fetch(`${YOLO_SERVICE_URL}/detect-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          mimeType: mimeType || "image/jpeg",
          confidence: confidence || 0.3,
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout for large images
      });

      if (!yoloResponse.ok) {
        const errText = await yoloResponse.text();
        throw new Error(`YOLO service error: ${errText}`);
      }

      const result = await yoloResponse.json();
      console.log(`[YOLO] Detected ${result.totalCount} objects in image`);
      return res.json(result);

    } catch (err: any) {
      console.error("[YOLO] Detection error:", err.message);
      return res.status(500).json({
        error: "YOLOv8 detection failed",
        details: err.message,
        yoloOffline: err.message?.includes("ECONNREFUSED") || err.message?.includes("fetch"),
      });
    }
  });

  // ─── YOLOv8 Video Frame Detection ──────────────────────────────────────────
  app.post("/api/yolo-detect-frame", async (req, res) => {
    try {
      const { frame, mimeType, confidence } = req.body;

      if (!frame) {
        return res.status(400).json({ error: "No frame data provided." });
      }

      // Forward to Python service
      const yoloResponse = await fetch(`${YOLO_SERVICE_URL}/detect-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frame,
          mimeType: mimeType || "image/jpeg",
          confidence: confidence || 0.25,
        }),
        signal: AbortSignal.timeout(15000), // 15s per frame
      });

      if (!yoloResponse.ok) {
        const errText = await yoloResponse.text();
        throw new Error(`YOLO frame error: ${errText}`);
      }

      const result = await yoloResponse.json();
      return res.json(result);

    } catch (err: any) {
      console.error("[YOLO-FRAME] Frame detection error:", err.message);
      return res.status(500).json({ error: "Frame detection failed", details: err.message });
    }
  });

  // ─── Gemini Image Detection (original) ────────────────────────────────────
  app.post("/api/detect", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "لم يتم توفير بيانات الصورة. الرجاء تحميل صورة صالحة." });
      }

      if (!ai) {
        // Fallback to high-quality procedural mock data
        console.log("Mock data generated for client.");
        return res.json(getMockData());
      }

      // Convert image base64 directly to inlineData structure
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      };

      const systemPrompt = `
You are an expert military and civilian aerospace surveillance assistant in an Intelligent Aircraft Detection System (نظام الكشف الذكي عن الطائرات).
Analyze the loaded aerial/radar/photo imagery.
Detect ALL aircraft visible in the image. For each aircraft, return:
1. Coordinates representing its bounding box inside the image.
   Scale coordinates from 0 to 1000 so they map uniformly to any display aspect ratio:
   - ymin (0 is top edge, 1000 is bottom edge)
   - xmin (0 is left edge, 1000 is right edge)
   - ymax (0 is top edge, 1000 is bottom edge)
   - xmax (0 is left edge, 1000 is right edge)
   Make sure the bounding boxes are tight, precise, and isolate the aircraft correctly.
2. The aircraft model name. Give specific names if possible, e.g. "F-16 Fighting Falcon", "Boeing 737-800", "F-35 Lightning II", "Su-35 Flanker-E", "Eurofighter Typhoon", "UH-60 Black Hawk".
3. Aircraft Type category. Choose strictly from: "Military" (عسكري), "Civilian" (مدني), "Cargo" (شحن), "Private" (خاص), "Helicopter" (هليكوبتر), "Drone" (مسيرة).
4. A high confidence rating (between 0.0 and 1.0) based on visibility.
5. A meticulous, professional technical description in Arabic (descriptionAr) detailing:
   - Maximum speed or engine configuration
   - Combat/surveillance/passenger role
   - Distinctive wing sweep or tail design visible
6. Provide an overall status summary in Arabic (summaryAr) of the detected objects and fleet composition.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [imagePart, systemPrompt],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["aircrafts", "totalCount", "summaryAr"],
            properties: {
              totalCount: {
                type: Type.INTEGER,
                description: "Total number of aircraft detected in the imagery",
              },
              summaryAr: {
                type: Type.STRING,
                description: "Deep military/traffic survey diagnostic summary in Arabic",
              },
              aircrafts: {
                type: Type.ARRAY,
                description: "List of aircraft found detailing coordinates and metadata",
                items: {
                  type: Type.OBJECT,
                  required: ["ymin", "xmin", "ymax", "xmax", "aircraftName", "aircraftType", "confidence", "descriptionAr"],
                  properties: {
                    ymin: { type: Type.INTEGER, description: "Top coordinate 0-1000" },
                    xmin: { type: Type.INTEGER, description: "Left coordinate 0-1000" },
                    ymax: { type: Type.INTEGER, description: "Bottom coordinate 0-1000" },
                    xmax: { type: Type.INTEGER, description: "Right coordinate 0-1000" },
                    aircraftName: { type: Type.STRING, description: "Specific technical model name" },
                    aircraftType: { type: Type.STRING, description: "Military, Civilian, Helicopter, Drone, Cargo, or Private" },
                    confidence: { type: Type.NUMBER, description: "Detection accuracy ratio from 0.0 to 1.0" },
                    descriptionAr: { type: Type.STRING, description: "SURVEILLANCE REPORT: Beautiful technical writeup in Arabic" },
                  },
                },
              },
            },
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("تلقى بقيمة فارغة من خادم الذكاء الاصطناعي.");
      }

      const parsedData = JSON.parse(responseText);
      return res.json({ ...parsedData, detectionSource: "gemini" });
    } catch (err: any) {
      console.error("API Error in Object Detection:", err);
      return res.status(500).json({
        error: "فشل التحليل الذكي للصورة",
        details: err.message || err,
        fallback: getMockData(),
      });
    }
  });

  // Serve static assets in production or use Vite dev server in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SURVEILLANCE SERVER] Online on http://0.0.0.0:${PORT}`);
    console.log(`[YOLO SERVICE] Expected at ${YOLO_SERVICE_URL}`);
    console.log(`[YOLO SERVICE] Start it with: detect_service/start_service.bat`);
  });
}

// Procedural high quality mock system
function getMockData() {
  return {
    totalCount: 3,
    detectionSource: "mock",
    summaryAr: "تم الكشف عن ٣ طائرات في الصورة بنجاح بواسطة نظام المراقبة الافتراضي. يتضمن التشكيل طائرة تفوق جوي عسكرية وطائرتين لنقل الركاب والشحن في قطاع المراقبة.",
    aircrafts: [
      {
        ymin: 150,
        xmin: 220,
        ymax: 520,
        xmax: 780,
        aircraftName: "F-16 Fighting Falcon",
        aircraftType: "Military",
        confidence: 0.98,
        descriptionAr: "طائرة مقاتلة متعددة المهام متفوقة تكتيكياً، تعمل بمحرك توربيني نفاث واحد وتصل سرعتها القصوى إلى ماخ ٢. تتميز بقدرة عالية على المناورة وتوجيه الرادار المتقدم."
      },
      {
        ymin: 580,
        xmin: 80,
        ymax: 850,
        xmax: 480,
        aircraftName: "Airbus A320neo",
        aircraftType: "Civilian",
        confidence: 0.95,
        descriptionAr: "طائرة ركاب مدنية ضيقة البدن وذات كفاءة عالية في استهلاك الوقود. مجهزة بمحركات الجيل الجديد وتتسع لما يصل إلى ١٨٠ راكبًا للخطوط الإقليمية والدولية القصيرة."
      },
      {
        ymin: 450,
        xmin: 580,
        ymax: 710,
        xmax: 920,
        aircraftName: "C-130 Hercules",
        aircraftType: "Cargo",
        confidence: 0.88,
        descriptionAr: "طائرة النقل العسكري التكتيكي الأسطورية المزودة بأربعة محركات دفع توربينية. مصممة للعمل في المدارج غير المعبدة والإنزال الجوي الثقيل والدعم اللوجستي."
      }
    ]
  };
}

startServer();
