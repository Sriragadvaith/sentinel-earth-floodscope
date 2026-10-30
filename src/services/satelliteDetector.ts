import type { FloodDetectionResult, SensorType } from "../types/detection";

const BACKEND_URL = "http://127.0.0.1:8000";

/**
 * Executes satellite water & flood detection either via the real FastAPI Python backend
 * (which uses OpenCV + Otsu / MNDWI algorithms on the actual pixels) or client-side Canvas fallback.
 */
export async function analyzeSatelliteImagery(
  file: File,
  sensorType: SensorType,
  bbox?: [number, number, number, number],
  preFile?: File | null
): Promise<FloodDetectionResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sensor_type", sensorType);

  if (bbox && bbox.length === 4) {
    formData.append("min_lon", String(bbox[0]));
    formData.append("min_lat", String(bbox[1]));
    formData.append("max_lon", String(bbox[2]));
    formData.append("max_lat", String(bbox[3]));
  }

  if (preFile) {
    formData.append("pre_file", preFile);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/detect-flood`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        timestamp: new Date().toISOString(),
      };
    }
    // If backend returns an error or is uncontactable, throw or proceed to client-side pipeline
    console.warn("Backend API returned non-200. Utilizing in-browser computer vision fallback.");
  } catch {
    console.warn("FastAPI backend not running at port 8000. Running in-browser pixel segmentation engine.");
  }

  // Client-side real computer vision execution using HTML5 Canvas
  return analyzeClientSide(file, sensorType, bbox, preFile);
}

/**
 * In-browser genuine pixel analysis:
 * Decodes pixel bytes, computes Otsu threshold / spectral water absorption on the actual image,
 * and extracts candidate polygon boundaries.
 */
async function analyzeClientSide(
  file: File,
  sensorType: SensorType,
  bbox?: [number, number, number, number],
  _preFile?: File | null
): Promise<FloodDetectionResult> {
  const startTime = performance.now();
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  // Offscreen canvas for genuine image pixel processing
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not initialize 2D canvas context for pixel analysis.");

  ctx.drawImage(bitmap, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // Compute grayscale histogram for Otsu threshold
  const histogram = new Int32Array(256);
  const grayArray = new Uint8Array(width * height);

  for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    let intensity: number;
    if (sensorType === "optical") {
      // MNDWI-proxy: Green absorbs less than Red in clear/turbid water
      // Invert so water values have high brightness
      const waterVal = Math.max(0, Math.min(255, Math.round(g * 1.2 - r * 0.8)));
      intensity = waterVal;
    } else {
      // SAR backscatter: low return -> dark surface
      intensity = 255 - Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    grayArray[j] = intensity;
    histogram[intensity]++;
  }

  // Otsu's thresholding calculation
  const total = width * height;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  // Build binary water mask
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  const maskImgData = maskCtx?.createImageData(width, height);

  let waterPixelCount = 0;
  if (maskImgData) {
    for (let j = 0; j < grayArray.length; j++) {
      const idx = j * 4;
      const isWater = grayArray[j] >= threshold;
      if (isWater) {
        waterPixelCount++;
        maskImgData.data[idx] = 242;     // R (Marigold water mask)
        maskImgData.data[idx + 1] = 183; // G
        maskImgData.data[idx + 2] = 53;  // B
        maskImgData.data[idx + 3] = 180; // Alpha
      } else {
        maskImgData.data[idx] = 0;
        maskImgData.data[idx + 1] = 0;
        maskImgData.data[idx + 2] = 0;
        maskImgData.data[idx + 3] = 0;
      }
    }
    maskCtx?.putImageData(maskImgData, 0, 0);
  }

  const maskDataUri = maskCanvas.toDataURL("image/png");
  const waterCoverageRatio = roundTo(waterPixelCount / total, 4);

  // If georeferenced bounding box available, generate geographic vector features
  const isGeoreferenced = !!bbox && bbox.length === 4;
  const features: any[] = [];

  if (isGeoreferenced && bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    // Partition detected water into grid quad clusters for GeoJSON export
    const steps = 8;
    const dx = width / steps;
    const dy = height / steps;

    for (let sy = 0; sy < steps; sy++) {
      for (let sx = 0; sx < steps; sx++) {
        let blockWaterCount = 0;
        const startX = Math.floor(sx * dx);
        const endX = Math.floor((sx + 1) * dx);
        const startY = Math.floor(sy * dy);
        const endY = Math.floor((sy + 1) * dy);

        for (let y = startY; y < endY; y += 2) {
          for (let x = startX; x < endX; x += 2) {
            if (grayArray[y * width + x] >= threshold) {
              blockWaterCount++;
            }
          }
        }

        const blockTotal = ((endY - startY) / 2) * ((endX - startX) / 2);
        if (blockWaterCount / blockTotal > 0.35) {
          // Significant water concentration -> generate geo polygon
          const bMinLon = minLon + (startX / width) * (maxLon - minLon);
          const bMaxLon = minLon + (endX / width) * (maxLon - minLon);
          const bMinLat = maxLat - (endY / height) * (maxLat - minLat);
          const bMaxLat = maxLat - (startY / height) * (maxLat - minLat);

          features.push({
            type: "Feature",
            id: `det-cell-${sx}-${sy}`,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [roundTo(bMinLon, 5), roundTo(bMinLat, 5)],
                  [roundTo(bMaxLon, 5), roundTo(bMinLat, 5)],
                  [roundTo(bMaxLon, 5), roundTo(bMaxLat, 5)],
                  [roundTo(bMinLon, 5), roundTo(bMaxLat, 5)],
                  [roundTo(bMinLon, 5), roundTo(bMinLat, 5)],
                ],
              ],
            },
            properties: {
              id: `det-${sx}-${sy}`,
              confidence: blockWaterCount / blockTotal > 0.65 ? "HIGH" : "MODERATE",
              pixelArea: blockWaterCount,
              classification: "Candidate Inundation",
              evidenceBadge: "COMPUTED",
            },
          });
        }
      }
    }
  }

  const processingTimeMs = Math.round(performance.now() - startTime);

  let estimatedAreaKm2: number | null = null;
  if (isGeoreferenced && bbox) {
    const latDistKm = (bbox[3] - bbox[1]) * 111.0;
    const lonDistKm = (bbox[2] - bbox[0]) * 111.0 * Math.cos((16.5 * Math.PI) / 180);
    estimatedAreaKm2 = roundTo(waterCoverageRatio * latDistKm * lonDistKm, 2);
  }

  return {
    status: "success",
    algorithm: "In-Browser Otsu Radiometric & MNDWI-Proxy Segmentation",
    filename: file.name,
    sensorType,
    imageDimensions: { width, height, channels: 4 },
    isGeoreferenced,
    georeferenceBbox: isGeoreferenced && bbox ? bbox : null,
    processingTimeMs,
    waterPixelCount,
    waterCoverageRatio,
    estimatedInundationAreaKm2: estimatedAreaKm2,
    featuresCount: features.length,
    maskDataUri,
    geoJson: {
      type: "FeatureCollection",
      features,
    },
    uncertaintyNotes: [
      "Segmentation calculated on image pixel values using Otsu dynamic thresholding.",
      "Non-georeferenced imagery cannot be geographically overlaid on Vijayawada coordinates without known tie points.",
      "Specular reflections (e.g. wet tarmac or cloud shadow) can exhibit optical signatures similar to standing water.",
    ],
    evidenceBadge: "COMPUTED",
    timestamp: new Date().toISOString(),
  };
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
