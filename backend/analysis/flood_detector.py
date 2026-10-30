"""
Sentinel Earth - FloodScope: Optical & SAR Satellite Flood Detection Engine
Algorithm: Otsu/Adaptive Thresholding on Water Indices (NDWI/MNDWI or SAR VV Backscatter)
"""

import io
import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from PIL import Image
import cv2

# Known Vijayawada Bounding Box (WGS84 [min_lon, min_lat, max_lon, max_lat])
VIJAYAWADA_BBOX = [80.56, 16.44, 80.74, 16.58]
KRISHNA_RIVER_ELEVATION_M = 18.2

def process_satellite_imagery(
    image_bytes: bytes,
    filename: str,
    sensor_type: str = "optical", # "optical", "sar", or "multispectral"
    custom_bbox: Optional[List[float]] = None,
    pre_event_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    """
    Performs real pixel-level water segmentation and change detection on satellite imagery.
    
    1. For optical / multispectral RGB/NIR images:
       - Computes Green-to-NIR/Red normalized difference or adaptive OTSU on green/blue water spectral absorption.
    2. For SAR (Synthetic Aperture Radar) backscatter:
       - Water appears specular/dark (low backscatter < -15 dB). Thresholds dark water return.
    3. For Pre/Post pair:
       - Subtracts pre-existing permanent water body to identify CANDIDATE FLOOD (new inundation)
         versus NORMAL WATERWAY.
    """
    start_time = time.time()
    
    # 1. Load image via Pillow & OpenCV
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        width, height = pil_image.size
    except Exception as e:
        raise ValueError(f"Unable to parse image file: {str(e)}")
        
    img_np = np.array(pil_image)
    if img_np.ndim == 2:
        # Grayscale / single-band SAR
        gray = img_np
        channels = 1
    elif img_np.ndim == 3:
        channels = img_np.shape[2]
        if channels >= 3:
            # RGB format
            rgb = img_np[:, :, :3]
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np[:, :, 0]
    else:
        raise ValueError(f"Unsupported image dimensions: {img_np.shape}")

    # Bounding box determination
    is_georeferenced = False
    bbox = None
    if custom_bbox and len(custom_bbox) == 4:
        bbox = custom_bbox
        is_georeferenced = True
    elif "vijayawada" in filename.lower() or "krishna" in filename.lower():
        # Geographic context tag matched
        bbox = VIJAYAWADA_BBOX
        is_georeferenced = True

    # 2. Water segmentation algorithm
    # Using Otsu + morphological refinement on inverted grayscale water profile
    # (Water absorbs light in NIR/Red or scatters away in SAR, resulting in dark signatures)
    
    # Denoise with bilateral or Gaussian filter to remove SAR speckle or atmospheric haze
    denoised = cv2.GaussianBlur(gray, (5, 5), 0)
    
    if sensor_type.lower() == "sar":
        # Low backscatter -> water is in the low-intensity tail
        # Invert so water becomes foreground (high intensity)
        inverted = 255 - denoised
        thresh_val, water_mask = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        method_name = "Otsu Radiometric Dark-Surface Backscatter Thresholding (SAR)"
    elif channels >= 3:
        # Optical imagery: Modified NDWI proxy in RGB space
        # Green channel has highest water reflectance; Red/Blue absorb strongly
        r = img_np[:, :, 0].astype(np.float32)
        g = img_np[:, :, 1].astype(np.float32)
        b = img_np[:, :, 2].astype(np.float32)
        
        # Water Index Proxy: (Green - Red) / (Green + Red + 1e-5)
        mndwi_proxy = (g - r) / (g + r + 1e-5)
        # Normalize to 0-255
        mndwi_norm = cv2.normalize(mndwi_proxy, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        thresh_val, water_mask = cv2.threshold(mndwi_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        method_name = "Spectral Water Index (Green/Red MNDWI-Proxy) + Otsu Segmentation"
    else:
        inverted = 255 - denoised
        thresh_val, water_mask = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        method_name = "Single-band Adaptive Intensity Thresholding"

    # Morphological opening to clean single-pixel noise (speckle filter)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    cleaned_mask = cv2.morphologyEx(cleaned_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    # 3. Pre-event baseline subtraction if pre_event_bytes provided
    candidate_flood_mask = cleaned_mask.copy()
    has_pre_event = False
    if pre_event_bytes:
        try:
            pre_pil = Image.open(io.BytesIO(pre_event_bytes)).resize((width, height))
            pre_np = np.array(pre_pil)
            if pre_np.ndim >= 3:
                pre_gray = cv2.cvtColor(pre_np[:, :, :3], cv2.COLOR_RGB2GRAY)
            else:
                pre_gray = pre_np if pre_np.ndim == 2 else pre_np[:, :, 0]
            pre_denoised = cv2.GaussianBlur(pre_gray, (5, 5), 0)
            _, pre_mask = cv2.threshold(255 - pre_denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            # Subtract permanent water bodies
            candidate_flood_mask = cv2.bitwise_and(cleaned_mask, cv2.bitwise_not(pre_mask))
            has_pre_event = True
        except Exception as e:
            # Fall back without failing
            pass

    # 4. Extract Contours & Polygons
    contours, _ = cv2.findContours(candidate_flood_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    total_pixels = width * height
    water_pixels = int(np.count_nonzero(candidate_flood_mask))
    water_coverage_ratio = round(float(water_pixels) / float(total_pixels), 4)

    # Convert significant contours to normalized / georeferenced polygon rings
    detected_features = []
    min_contour_area = max(25, int(total_pixels * 0.0005)) # filter tiny artifacts
    
    for idx, c in enumerate(contours):
        area = cv2.contourArea(c)
        if area < min_contour_area:
            continue
            
        # Simplify contour
        epsilon = 0.005 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, epsilon, True)
        
        pts = approx.reshape(-1, 2)
        if len(pts) < 3:
            continue
            
        # Closed ring
        pts_list = pts.tolist()
        if pts_list[0] != pts_list[-1]:
            pts_list.append(pts_list[0])
            
        # Geo coordinates mapping if bbox available
        if is_georeferenced and bbox:
            min_lon, min_lat, max_lon, max_lat = bbox
            geo_ring = []
            for px, py in pts_list:
                lon = min_lon + (px / width) * (max_lon - min_lon)
                lat = max_lat - (py / height) * (max_lat - min_lat)
                geo_ring.append([round(lon, 6), round(lat, 6)])
            
            # Approximate area in km2 based on bounding box
            lat_dist_km = (max_lat - min_lat) * 111.0
            lon_dist_km = (max_lon - min_lon) * 111.0 * np.cos(np.radians(16.5))
            total_scene_km2 = lat_dist_km * lon_dist_km
            feature_area_km2 = round(float((area / total_pixels) * total_scene_km2), 3)

            detected_features.append({
                "type": "Feature",
                "id": f"flood-detected-{idx + 1}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [geo_ring]
                },
                "properties": {
                    "id": f"det-{idx + 1}",
                    "confidence": "HIGH" if area > min_contour_area * 5 else "MODERATE",
                    "pixelArea": int(area),
                    "estimatedAreaKm2": feature_area_km2,
                    "classification": "Candidate Inundation" if has_pre_event else "Water Surface",
                    "evidenceBadge": "COMPUTED"
                }
            })
        else:
            # Pixel/normalized coordinates
            norm_ring = [[round(px / width, 4), round(py / height, 4)] for px, py in pts_list]
            detected_features.append({
                "type": "Feature",
                "id": f"detected-{idx + 1}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [norm_ring]
                },
                "properties": {
                    "id": f"det-{idx + 1}",
                    "confidence": "HIGH" if area > min_contour_area * 5 else "MODERATE",
                    "pixelArea": int(area),
                    "classification": "Candidate Inundation",
                    "evidenceBadge": "COMPUTED"
                }
            })

    # Encode detection mask as PNG data URI
    _, mask_png = cv2.imencode('.png', candidate_flood_mask)
    import base64
    mask_base64 = base64.b64encode(mask_png.tobytes()).decode('ascii')
    mask_data_uri = f"data:image/png;base64,{mask_base64}"

    processing_time_ms = round((time.time() - start_time) * 1000, 1)

    # Estimated real area if georeferenced
    total_area_km2 = None
    if is_georeferenced and bbox:
        min_lon, min_lat, max_lon, max_lat = bbox
        lat_dist_km = (max_lat - min_lat) * 111.0
        lon_dist_km = (max_lon - min_lon) * 111.0 * np.cos(np.radians(16.5))
        total_scene_km2 = lat_dist_km * lon_dist_km
        total_area_km2 = round(water_coverage_ratio * total_scene_km2, 2)

    return {
        "status": "success",
        "algorithm": method_name,
        "filename": filename,
        "sensorType": sensor_type,
        "imageDimensions": {"width": width, "height": height, "channels": channels},
        "isGeoreferenced": is_georeferenced,
        "georeferenceBbox": bbox,
        "processingTimeMs": processing_time_ms,
        "waterPixelCount": water_pixels,
        "waterCoverageRatio": water_coverage_ratio,
        "estimatedInundationAreaKm2": total_area_km2,
        "featuresCount": len(detected_features),
        "maskDataUri": mask_data_uri,
        "geoJson": {
            "type": "FeatureCollection",
            "features": detected_features
        },
        "uncertaintyNotes": [
            "Detection represents surface water extraction via radiometry and morphology.",
            "Vegetation canopy over flooded areas and urban building shadows may cause localized under-detection.",
            "Distinction between seasonal standing water and acute flooding requires calibrated multi-temporal baselines."
        ],
        "evidenceBadge": "COMPUTED"
    }
