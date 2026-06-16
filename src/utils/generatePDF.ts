/**
 * generatePDF.ts
 * Generates a downloadable military-style PDF detection report.
 *
 * For each detection:
 *  Page 1 – Full image/frame with ALL bounding boxes drawn in their palette colors
 *  Page N – One page per detected object with:
 *            • Cropped object thumbnail (zoomed bbox region)
 *            • All aircraft_info.json fields (specs, roles, strengths, weaknesses)
 */

import jsPDF from "jspdf";
import { Aircraft, DetectionResult } from "../types";

// ---------- Palette (mirrors BOX_PALETTE in DetectionReport.tsx) ----------
const RAW_PALETTE: { r: number; g: number; b: number }[] = [
  { r: 239, g: 68,  b: 68  }, // rose-500
  { r: 56,  g: 189, b: 248 }, // sky-400
  { r: 251, g: 191, b: 36  }, // amber-400
  { r: 52,  g: 211, b: 153 }, // emerald-400
  { r: 167, g: 139, b: 250 }, // violet-400
  { r: 244, g: 114, b: 182 }, // pink-400
  { r: 34,  g: 211, b: 238 }, // cyan-400
  { r: 251, g: 146, b: 60  }, // orange-400
];

function getPal(i: number) {
  return RAW_PALETTE[i % RAW_PALETTE.length];
}

// ---------- Helper: draw bounding boxes on a canvas ----------
function drawBoxesOnCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  aircrafts: Aircraft[],
  imgW: number,
  imgH: number,
  highlight?: number        // index of the single box to draw (undefined = all)
) {
  const targets = highlight !== undefined ? [{ ac: aircrafts[highlight], i: highlight }] : aircrafts.map((ac, i) => ({ ac, i }));

  for (const { ac, i } of targets) {
    const pal = getPal(i);
    const x    = (ac.xmin / 1000) * imgW;
    const y    = (ac.ymin / 1000) * imgH;
    const w    = ((ac.xmax - ac.xmin) / 1000) * imgW;
    const h    = ((ac.ymax - ac.ymin) / 1000) * imgH;

    const hexColor = `rgb(${pal.r},${pal.g},${pal.b})`;

    // Main border
    ctx.strokeStyle = hexColor;
    ctx.lineWidth   = Math.max(2, imgW / 300);
    ctx.strokeRect(x, y, w, h);

    // Semi-transparent fill
    ctx.fillStyle = `rgba(${pal.r},${pal.g},${pal.b},0.08)`;
    ctx.fillRect(x, y, w, h);

    // Corner reticles
    const cs = Math.min(16, w * 0.18, h * 0.18);
    ctx.lineWidth = Math.max(2, imgW / 250);
    ctx.strokeStyle = hexColor;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx as number + (dx as number) * cs, cy as number);
      ctx.lineTo(cx as number, cy as number);
      ctx.lineTo(cx as number, cy as number + (dy as number) * cs);
      ctx.stroke();
    });

    // Label badge
    const label = `[${i + 1}] ${ac.rawClass || ac.aircraftName}  ${Math.round(ac.confidence * 100)}%`;
    const fontSize = Math.max(10, imgW / 80);
    ctx.font = `bold ${fontSize}px monospace`;
    const textW = ctx.measureText(label).width + fontSize;
    const badgeH = fontSize * 1.7;
    ctx.fillStyle   = hexColor;
    ctx.fillRect(x, y - badgeH, textW, badgeH);
    ctx.fillStyle   = "#ffffff";
    ctx.fillText(label, x + fontSize * 0.35, y - fontSize * 0.45);
  }
}

// ---------- Helper: load image into HTMLImageElement ----------
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- Helper: build a canvas with image + boxes ----------
async function buildImageCanvas(imageSrc: string, aircrafts: Aircraft[], highlight?: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  drawBoxesOnCanvas(canvas, ctx, aircrafts, canvas.width, canvas.height, highlight);
  return canvas;
}

// ---------- Helper: add header stripe to PDF page ----------
function addPageHeader(pdf: jsPDF, title: string, subtitle: string) {
  const pw = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(3, 7, 18);
  pdf.rect(0, 0, pw, 22, "F");
  pdf.setTextColor(52, 211, 153);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("◈ INTELLIGENT AIRCRAFT DETECTION SYSTEM — CLASSIFIED INTELLIGENCE REPORT", 10, 8);
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(7.5);
  pdf.text(title.toUpperCase(), 10, 14);
  pdf.setTextColor(100, 116, 139);
  pdf.text(subtitle, 10, 19);

  // timestamp right side
  pdf.setTextColor(52, 211, 153);
  const ts = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
  pdf.text(ts, pw - 10, 19, { align: "right" });
}

// ---------- Helper: add footer stripe ----------
function addPageFooter(pdf: jsPDF, pageNum: number, total: number) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(3, 7, 18);
  pdf.rect(0, ph - 12, pw, 12, "F");
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("TOP SECRET • AI AEROSPACE COMMAND © 2026 • SHA-512 ENCRYPTED", 10, ph - 4);
  pdf.text(`Page ${pageNum} / ${total}`, pw - 10, ph - 4, { align: "right" });
}

// ---------- Helper: draw an info row in the PDF ----------
function infoRow(pdf: jsPDF, x: number, y: number, label: string, value: string, maxW: number): number {
  const lineH = 5.5;
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "bold");
  pdf.text(label.toUpperCase(), x, y);
  pdf.setTextColor(226, 232, 240);
  pdf.setFont("helvetica", "normal");
  const lines = pdf.splitTextToSize(value, maxW - 45);
  pdf.text(lines, x + 42, y);
  return y + lineH * lines.length;
}

// ======================================================================
// MAIN EXPORT: generateDetectionPDF
// ======================================================================
export async function generateDetectionPDF(opts: {
  imageSrc:        string | null;   // full image URL / blob URL (image tab)
  videoFrame:      string | null;   // base64 JPEG frame (video tab) — optional
  detectionResult: DetectionResult | null;
  mode:            "image" | "video";
  gpsCoords?:      string;
}) {
  const { imageSrc, videoFrame, detectionResult, mode, gpsCoords } = opts;
  const aircrafts = detectionResult?.aircrafts || [];

  if (!imageSrc && !videoFrame) {
    alert("No image or video frame available. Please run a detection first.");
    return;
  }
  if (aircrafts.length === 0) {
    alert("No detections found. Please run detection on an image or video first.");
    return;
  }

  const src = imageSrc || `data:image/jpeg;base64,${videoFrame}`;

  // Total pages: 1 overview + 1 per aircraft
  const totalPages = 1 + aircrafts.length;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw  = pdf.internal.pageSize.getWidth();   // 210 mm
  const ph  = pdf.internal.pageSize.getHeight();  // 297 mm

  // ── PAGE 1: Overview with full annotated image ──────────────────────────────
  addPageHeader(pdf, "Section 1 — Full Annotated Detection Overview", `Source: ${mode === "video" ? "Video Frame Capture" : "Uploaded Image"}  •  Objects: ${aircrafts.length}  •  GPS: ${gpsCoords || "N/A"}`);

  // Dark background
  pdf.setFillColor(8, 12, 28);
  pdf.rect(0, 22, pw, ph - 34, "F");

  // Section title
  let yPos = 30;
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(10, yPos, pw - 20, 9, 1.5, 1.5, "F");
  pdf.setTextColor(52, 211, 153);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("▶ ANNOTATED DETECTION IMAGE — ALL BOUNDING BOXES", 14, yPos + 6);
  yPos += 14;

  // Draw full image with ALL boxes
  let overviewCanvas: HTMLCanvasElement;
  try {
    overviewCanvas = await buildImageCanvas(src, aircrafts);
  } catch {
    alert("Failed to load image for PDF. Try again.");
    return;
  }

  const maxImgW = pw - 20;
  const maxImgH = ph - yPos - 50;
  const aspect  = overviewCanvas.width / overviewCanvas.height;
  let imgW = maxImgW;
  let imgH = imgW / aspect;
  if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspect; }
  const imgX = (pw - imgW) / 2;

  const overviewDataUrl = overviewCanvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(overviewDataUrl, "JPEG", imgX, yPos, imgW, imgH);

  // Legend strip below image
  yPos += imgH + 5;
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(10, yPos, pw - 20, 16, 1.5, 1.5, "F");
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  let lx = 14;
  aircrafts.forEach((ac, i) => {
    const pal = getPal(i);
    pdf.setFillColor(pal.r, pal.g, pal.b);
    pdf.circle(lx + 3, yPos + 8, 3, "F");
    pdf.setTextColor(226, 232, 240);
    const label = `[${i + 1}] ${ac.rawClass || ac.aircraftName}`;
    pdf.text(label, lx + 8, yPos + 10);
    lx += pdf.getTextWidth(label) + 15;
    if (lx > pw - 30) { lx = 14; yPos += 9; }
  });

  addPageFooter(pdf, 1, totalPages);

  // ── PAGES 2…N: One page per aircraft ────────────────────────────────────────
  for (let i = 0; i < aircrafts.length; i++) {
    pdf.addPage();
    const ac  = aircrafts[i];
    const pal = getPal(i);

    addPageHeader(
      pdf,
      `Section ${i + 2} — Object [${i + 1}]: ${ac.aircraftName}`,
      `Confidence: ${Math.round(ac.confidence * 100)}%  •  Type: ${ac.aircraftType}  •  Source: ${detectionResult?.detectionSource?.toUpperCase() || "YOLO"}`
    );

    pdf.setFillColor(8, 12, 28);
    pdf.rect(0, 22, pw, ph - 34, "F");

    let y = 30;

    // Color-coded title bar
    pdf.setFillColor(pal.r, pal.g, pal.b);
    pdf.rect(10, y, 4, 9, "F");
    pdf.setFillColor(15, 23, 42);
    pdf.rect(14, y, pw - 24, 9, "F");
    pdf.setTextColor(pal.r, pal.g, pal.b);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`[${i + 1}]  ${ac.aircraftName.toUpperCase()}`, 18, y + 6.5);
    y += 13;

    // ── Left column: Cropped zoomed image ─────────────────────────
    const colW = 85;

    // Build cropped canvas: just the bbox region + padding
    let cropDataUrl: string | null = null;
    try {
      const fullCanvas = await buildImageCanvas(src, aircrafts, i);
      const cx  = (ac.xmin / 1000) * fullCanvas.width;
      const cy  = (ac.ymin / 1000) * fullCanvas.height;
      const cw  = ((ac.xmax - ac.xmin) / 1000) * fullCanvas.width;
      const ch  = ((ac.ymax - ac.ymin) / 1000) * fullCanvas.height;
      const pad = Math.min(30, cw * 0.15, ch * 0.15);
      const sx  = Math.max(0, cx - pad);
      const sy  = Math.max(0, cy - pad);
      const sw  = Math.min(fullCanvas.width  - sx, cw + pad * 2);
      const sh  = Math.min(fullCanvas.height - sy, ch + pad * 2);

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width  = sw;
      cropCanvas.height = sh;
      const cctx = cropCanvas.getContext("2d")!;
      cctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      cropDataUrl = cropCanvas.toDataURL("image/jpeg", 0.92);
    } catch {
      cropDataUrl = null;
    }

    if (cropDataUrl) {
      // Compute display size for crop inside left column
      const bboxAspect = ((ac.xmax - ac.xmin) / (ac.ymax - ac.ymin)) || 1;
      let dispW = colW - 2;
      let dispH = dispW / bboxAspect;
      const maxCropH = 80;
      if (dispH > maxCropH) { dispH = maxCropH; dispW = dispH * bboxAspect; }

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(10, y, colW, dispH + 4, 2, 2, "F");
      pdf.setDrawColor(pal.r, pal.g, pal.b);
      pdf.setLineWidth(0.6);
      pdf.roundedRect(10, y, colW, dispH + 4, 2, 2, "S");
      pdf.addImage(cropDataUrl, "JPEG", 10 + (colW - dispW) / 2, y + 2, dispW, dispH);

      // Confidence badge below crop
      const confY = y + dispH + 7;
      pdf.setFillColor(pal.r, pal.g, pal.b);
      pdf.roundedRect(10, confY, colW, 7, 1.5, 1.5, "F");
      pdf.setTextColor(8, 12, 28);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "bold");
      pdf.text(`CONFIDENCE: ${Math.round(ac.confidence * 100)}%   CLASS: ${ac.rawClass || ac.aircraftType}`, 12, confY + 5);
    }

    // ── Right column: Intelligence fields ─────────────────────────────────────
    const rightX = 10 + colW + 8;
    const rightW = pw - rightX - 10;
    let ry = y;

    pdf.setFillColor(15, 23, 42);
    pdf.roundedRect(rightX, ry, rightW, 8, 1.5, 1.5, "F");
    pdf.setTextColor(pal.r, pal.g, pal.b);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("IDENTIFICATION", rightX + 3, ry + 5.5);
    ry += 11;

    const fields: [string, string | number | undefined | null][] = [
      ["Aircraft Name",  ac.aircraftName],
      ["Raw Class",      ac.rawClass],
      ["Type",           ac.aircraftType],
      ["Country",        ac.country],
      ["Manufacturer",   ac.manufacturer],
      ["First Flight",   ac.first_flight],
      ["Crew",           ac.crew],
      ["Max Speed",      ac.max_speed],
      ["Range",          ac.range],
    ];

    for (const [label, val] of fields) {
      if (!val) continue;
      ry = infoRow(pdf, rightX, ry, label, String(val), rightW + rightX - 10);
      ry += 1;
      if (ry > ph - 50) break;
    }

    // Bbox coordinates block
    ry += 3;
    pdf.setFillColor(15, 23, 42);
    pdf.roundedRect(rightX, ry, rightW, 8, 1.5, 1.5, "F");
    pdf.setTextColor(pal.r, pal.g, pal.b);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("BOUNDING BOX TELEMETRY", rightX + 3, ry + 5.5);
    ry += 10;
    pdf.setTextColor(226, 232, 240);
    pdf.setFontSize(7);
    pdf.setFont("courier", "normal");
    pdf.text(`xmin: ${ac.xmin}   ymin: ${ac.ymin}   xmax: ${ac.xmax}   ymax: ${ac.ymax}   scale: 0..1000`, rightX, ry);
    ry += 8;

    // ── Below both columns: Description ──────────────────────────────────────
    const belowY = Math.max(y + 100, ry) + 4;

    if (ac.descriptionAr) {
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(10, belowY, pw - 20, 8, 1.5, 1.5, "F");
      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text("INTELLIGENCE SUMMARY", 13, belowY + 5.5);
      let dy = belowY + 12;
      pdf.setTextColor(203, 213, 225);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      const descLines = pdf.splitTextToSize(ac.descriptionAr, pw - 22);
      pdf.text(descLines.slice(0, 8), 10, dy);
      dy += descLines.slice(0, 8).length * 5 + 4;

      // Primary roles tags
      if (ac.primary_roles && ac.primary_roles.length > 0) {
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(pal.r, pal.g, pal.b);
        pdf.text("PRIMARY ROLES:", 10, dy);
        dy += 5;
        const rolesText = ac.primary_roles.join("   •   ");
        pdf.setTextColor(203, 213, 225);
        pdf.setFont("helvetica", "normal");
        pdf.text(pdf.splitTextToSize(rolesText, pw - 22), 10, dy);
        dy += 8;
      }

      // Strengths / weaknesses side by side
      const halfW = (pw - 22) / 2;
      if (ac.strengths && ac.strengths.length > 0) {
        pdf.setFillColor(5, 46, 22);
        pdf.roundedRect(10, dy, halfW, Math.max(20, ac.strengths.length * 5 + 10), 1.5, 1.5, "F");
        pdf.setTextColor(52, 211, 153);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.text("✓ STRENGTHS", 13, dy + 6);
        pdf.setTextColor(187, 247, 208);
        pdf.setFont("helvetica", "normal");
        ac.strengths.slice(0, 5).forEach((s, si) => {
          pdf.text(`• ${s}`, 13, dy + 12 + si * 5);
        });
      }
      if (ac.weaknesses && ac.weaknesses.length > 0) {
        const wx = 12 + halfW + 1;
        pdf.setFillColor(69, 10, 10);
        pdf.roundedRect(wx, dy, halfW, Math.max(20, ac.weaknesses.length * 5 + 10), 1.5, 1.5, "F");
        pdf.setTextColor(239, 68, 68);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.text("✗ WEAKNESSES", wx + 3, dy + 6);
        pdf.setTextColor(254, 202, 202);
        pdf.setFont("helvetica", "normal");
        ac.weaknesses.slice(0, 5).forEach((w, wi) => {
          pdf.text(`• ${w}`, wx + 3, dy + 12 + wi * 5);
        });
      }
    }

    addPageFooter(pdf, i + 2, totalPages);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const ts   = new Date().toISOString().replace(/[:.TZ]/g, "-").substring(0, 19);
  const name = `Aircraft_Detection_Report_${ts}.pdf`;
  pdf.save(name);
}
