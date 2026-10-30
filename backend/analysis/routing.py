"""
Sentinel Earth - FloodScope: Disaster Routing & Flood Hazard Spatial Intersector
Location: Vijayawada, Andhra Pradesh, India
"""

import json
import math
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# High-risk Vijayawada Flood Hazard Boundaries (WGS84 [lng, lat])
VIJAYAWADA_HAZARD_ZONES = [
    {
        "name": "Krishna Lanka Low-Lying Riverfront Ward",
        "riskLevel": "CRITICAL",
        "polygon": [
            [80.6420, 16.5020],
            [80.6650, 16.4920],
            [80.6850, 16.4820],
            [80.6780, 16.4750],
            [80.6550, 16.4840],
            [80.6380, 16.4950],
            [80.6420, 16.5020]
        ]
    },
    {
        "name": "Ramalingeswara Nagar Flood Fringe",
        "riskLevel": "HIGH",
        "polygon": [
            [80.6880, 16.4820],
            [80.7080, 16.4740],
            [80.7150, 16.4820],
            [80.6950, 16.4900],
            [80.6880, 16.4820]
        ]
    },
    {
        "name": "Budameru Rivulet Overflow Corridor (Northern Belt)",
        "riskLevel": "CRITICAL",
        "polygon": [
            [80.6150, 16.5450],
            [80.6350, 16.5420],
            [80.6520, 16.5350],
            [80.6450, 16.5280],
            [80.6220, 16.5320],
            [80.6150, 16.5450]
        ]
    }
]

def haversine_distance(p1: List[float], p2: List[float]) -> float:
    """Distance in meters between [lng1, lat1] and [lng2, lat2]."""
    lng1, lat1 = p1
    lng2, lat2 = p2
    r = 6371008.8
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

def point_in_polygon(point: List[float], polygon: List[List[float]]) -> bool:
    """Ray casting algorithm to determine if [lng, lat] is inside polygon."""
    x, y = point
    inside = False
    n = len(polygon)
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def point_to_segment_distance(pt: List[float], s1: List[float], s2: List[float]) -> float:
    d = haversine_distance(s1, s2)
    if d == 0:
        return haversine_distance(pt, s1)
    # Simple projection
    cos_lat = math.cos(math.radians((s1[1] + s2[1]) / 2))
    dx = (s2[0] - s1[0]) * cos_lat
    dy = s2[1] - s1[1]
    t = max(0.0, min(1.0, (((pt[0] - s1[0]) * cos_lat * dx + (pt[1] - s1[1]) * dy) / (dx*dx + dy*dy)) if (dx*dx + dy*dy) > 0 else 0))
    proj = [s1[0] + t * (s2[0] - s1[0]), s1[1] + t * (s2[1] - s1[1])]
    return haversine_distance(pt, proj)

class RouteRequest(BaseModel):
    origin: List[float] = Field(..., min_length=2, max_length=2, description="[lng, lat]")
    destination: List[float] = Field(..., min_length=2, max_length=2, description="[lng, lat]")
    originName: Optional[str] = "Incident Location"
    destinationName: Optional[str] = "Destination Facility"
    avoidHazard: Optional[bool] = True

class RouteConflictItem(BaseModel):
    hazardName: str = Field(..., alias="hazardName")
    riskLevel: str
    distanceMeters: float

class RouteResponse(BaseModel):
    origin: List[float]
    destination: List[float]
    originName: str
    destinationName: str
    distanceMeters: float
    durationSeconds: float
    coordinates: List[List[float]]
    provider: str
    timestamp: str
    hasConflict: bool
    conflicts: List[Dict[str, Any]]
    conflictScorePercent: int
    statusMessage: str

def compute_route(req: RouteRequest) -> Dict[str, Any]:
    lng1, lat1 = req.origin
    lng2, lat2 = req.destination

    # 1. Attempt query to OpenStreetMap OSRM driving engine
    osrm_url = f"https://router.project-osrm.org/route/v1/driving/{lng1:.5f},{lat1:.5f};{lng2:.5f},{lat2:.5f}?overview=full&geometries=geojson"
    coordinates: List[List[float]] = []
    distance_meters = 0.0
    duration_seconds = 0.0
    provider = "OSRM Public Routing Engine (OpenStreetMap)"

    try:
        http_req = urllib.request.Request(osrm_url, headers={"User-Agent": "SentinelEarth-FloodScope/2.4"})
        with urllib.request.urlopen(http_req, timeout=4.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") == "Ok" and data.get("routes"):
                r0 = data["routes"][0]
                distance_meters = float(r0.get("distance", 0.0))
                duration_seconds = float(r0.get("duration", 0.0))
                coordinates = r0.get("geometry", {}).get("coordinates", [])
    except Exception:
        # Fallback to geodesic path interpolation if network timeout occurs
        provider = "Geodesic Direct Transit Path (OSRM Offline Fallback)"
        distance_meters = haversine_distance(req.origin, req.destination)
        # Assume average urban transit speed of 25 km/h during heavy weather
        duration_seconds = (distance_meters / 1000.0) / 25.0 * 3600.0
        # 16-point interpolated polyline
        steps = 16
        coordinates = [
            [
                lng1 + (lng2 - lng1) * (i / steps),
                lat1 + (lat2 - lat1) * (i / steps)
            ]
            for i in range(steps + 1)
        ]

    # 2. Check hazard conflicts along route
    conflicts: List[Dict[str, Any]] = []
    conflict_threshold = 80.0  # within 80m of hazard polygon

    for hazard in VIJAYAWADA_HAZARD_ZONES:
        poly = hazard["polygon"]
        min_dist = float("inf")

        # Check route points
        for pt in coordinates:
            if point_in_polygon(pt, poly):
                min_dist = 0.0
                break
            # Check edge distance
            for e in range(len(poly) - 1):
                d = point_to_segment_distance(pt, poly[e], poly[e + 1])
                if d < min_dist:
                    min_dist = d
                    if min_dist <= conflict_threshold:
                        break
            if min_dist <= conflict_threshold:
                break

        if min_dist <= conflict_threshold:
            conflicts.append({
                "hazardName": hazard["name"],
                "riskLevel": hazard["riskLevel"],
                "distanceMeters": round(min_dist, 1)
            })

    has_conflict = len(conflicts) > 0
    conflict_score = min(100, len(conflicts) * 35)

    status_msg = "Safe route clear of active flood hazard zones."
    if has_conflict:
        status_msg = f"WARNING: Route passes within {conflict_threshold:.0f}m of {len(conflicts)} mapped flood inundation zone(s)."

    return {
        "origin": req.origin,
        "destination": req.destination,
        "originName": req.originName or "Origin Point",
        "destinationName": req.destinationName or "Destination Facility",
        "distanceMeters": round(distance_meters, 1),
        "durationSeconds": round(duration_seconds, 0),
        "coordinates": coordinates,
        "provider": provider,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hasConflict": has_conflict,
        "conflicts": conflicts,
        "conflictScorePercent": conflict_score,
        "statusMessage": status_msg
    }
