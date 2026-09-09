"""Shared inference helpers for uploaded surveillance footage."""
from __future__ import annotations

from functools import lru_cache

import cv2
from ultralytics import YOLO

from .frame_store import append
from .zone_engine import ZoneViolationEngine
from .zones_api import get_zones_for_camera


PERSON_CLASS_ID = 0
CONFIDENCE_THRESHOLD = 0.45


@lru_cache(maxsize=1)
def get_model() -> YOLO:
    """Load the YOLO model only when inference is actually requested."""
    return YOLO("yolo11n.pt")


def _person_annotations(result, frame, camera_id: str | None = None, zone_engine: ZoneViolationEngine | None = None):
    """Return person detections and a frame annotated with person boxes/zones."""
    detections = []
    annotated = frame.copy()
    boxes = result.boxes
    if boxes is None:
        return detections, annotated, []

    ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
    classes = boxes.cls.int().cpu().tolist()
    scores = boxes.conf.cpu().tolist()
    coords = boxes.xyxy.cpu().tolist()
    zones = get_zones_for_camera(camera_id, include_disabled=False) if camera_id else []
    zone_events: list[dict] = []

    for track_id, cls_id, score, xyxy in zip(ids, classes, scores, coords):
        if int(cls_id) != PERSON_CLASS_ID:
            continue

        x1, y1, x2, y2 = [int(round(v)) for v in xyxy]
        confidence = float(score)
        containing: list[dict] = []
        entered: list[dict] = []
        if zone_engine is not None:
            containing, entered = zone_engine.evaluate(camera_id or "", track_id, [float(v) for v in xyxy], frame.shape[1], frame.shape[0], zones)
            zone_events.extend(entered)

        detections.append({
            "track_id": track_id,
            "label": "person",
            "confidence": confidence,
            "bbox": [float(v) for v in xyxy],
            "in_restricted_zone": bool(containing),
            "restricted_zones": containing,
        })

        label = f"PERSON {confidence:.0%}"
        if track_id is not None:
            label += f"  #{int(track_id)}"
        if containing:
            label = f"RESTRICTED · {label}"
        box_color = (60, 70, 235) if containing else (255, 190, 0)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 2)
        text_y = max(24, y1 - 8)
        text_width = min(frame.shape[1] - 1, x1 + 260)
        cv2.rectangle(annotated, (x1, max(0, text_y - 22)), (text_width, text_y + 2), box_color, -1)
        cv2.putText(annotated, label, (x1 + 6, text_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20, 20, 20), 2, cv2.LINE_AA)

    for zone in zones:
        polygon = [(int(point[0] * frame.shape[1]), int(point[1] * frame.shape[0])) for point in zone["points"]]
        if len(polygon) >= 3:
            cv2.polylines(annotated, [__import__("numpy").array(polygon, dtype="int32")], True, (80, 90, 235), 2)
            cv2.putText(annotated, zone["name"], polygon[0], cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 140, 255), 2, cv2.LINE_AA)

    return detections, annotated, zone_events


def analyze_frame(job_id: str, frame, sequence: int, camera_id: str | None = None, zone_engine: ZoneViolationEngine | None = None):
    result = get_model().track(frame, persist=True, conf=CONFIDENCE_THRESHOLD, verbose=False)[0]
    detections, annotated, zone_events = _person_annotations(result, frame, camera_id, zone_engine)

    ok, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    if ok:
        append(job_id, sequence, encoded.tobytes())
    return result, detections, zone_events
