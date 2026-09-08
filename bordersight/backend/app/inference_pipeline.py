"""Shared inference helpers for uploaded surveillance footage."""
from __future__ import annotations
import cv2
from ultralytics import YOLO
from .frame_store import append

MODEL = YOLO("yolo11n.pt")

def analyze_frame(job_id: str, frame, sequence: int):
    result = MODEL.track(frame, persist=True, conf=0.45, verbose=False)[0]
    detections = []
    boxes = result.boxes
    if boxes is not None:
        ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
        for track_id, cls_id, score, xyxy in zip(ids, boxes.cls.int().cpu().tolist(), boxes.conf.cpu().tolist(), boxes.xyxy.cpu().tolist()):
            detections.append({"track_id": track_id, "label": result.names[int(cls_id)], "confidence": float(score), "bbox": [float(v) for v in xyxy]})
    annotated = result.plot()
    ok, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    if ok:
        append(job_id, sequence, encoded.tobytes())
    return result, detections
