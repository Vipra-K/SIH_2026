"""Lightweight vision-event adapter for BorderSight API.

The adapter accepts frames from an uploaded video or webcam and exposes
structured detections/events. It is deliberately decoupled from HTTP so it
can later be moved to a worker process without changing the API contract.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import cv2
from ultralytics import YOLO

from .border_engine import BorderEngine


@dataclass
class VisionConfig:
    model: str = "yolo11n.pt"
    confidence: float = 0.45
    source: str | int = 0


class VisionStream:
    def __init__(self, config: VisionConfig):
        self.config = config
        self.model = YOLO(config.model)
        self.engine = BorderEngine()

    def frames(self):
        source: Any = self.config.source
        if isinstance(source, str) and source.isdigit():
            source = int(source)
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open source: {self.config.source}")
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                yield self.process(frame)
        finally:
            cap.release()

    def process(self, frame) -> dict:
        result = self.model.track(
            frame, persist=True, conf=self.config.confidence, verbose=False
        )[0]
        detections = []
        events = []
        now = time.time()
        boxes = result.boxes
        if boxes is not None:
            ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
            classes = boxes.cls.int().cpu().tolist()
            scores = boxes.conf.cpu().tolist()
            coords = boxes.xyxy.cpu().tolist()
            for track_id, cls_id, score, xyxy in zip(ids, classes, scores, coords):
                label = result.names[int(cls_id)]
                x1, y1, x2, y2 = xyxy
                cx = ((x1 + x2) / 2) / frame.shape[1]
                cy = ((y1 + y2) / 2) / frame.shape[0]
                detections.append({
                    "track_id": track_id,
                    "label": label,
                    "confidence": round(float(score), 4),
                    "bbox": [round(float(v), 2) for v in xyxy],
                })
                if track_id is not None and label in {"person", "car", "truck", "motorcycle"}:
                    events.extend(self.engine.update(int(track_id), (cx, cy), now, label))

        return {
            "timestamp": now,
            "frame_width": frame.shape[1],
            "frame_height": frame.shape[0],
            "detections": detections,
            "events": events,
        }
