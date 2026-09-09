"""Browser-camera ingestion for live BorderSight surveillance."""
from __future__ import annotations

import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request

from .inference_pipeline import CONFIDENCE_THRESHOLD, PERSON_CLASS_ID, get_model
from .realtime import hub

router = APIRouter(prefix="/api/live", tags=["live camera"])


@router.post("/{camera_id}/frame")
async def process_live_frame(camera_id: str, request: Request):
    """Run YOLO tracking on one JPEG frame captured by a browser camera."""
    body = await request.body()
    if not body:
        raise HTTPException(400, "Empty camera frame")

    frame = cv2.imdecode(np.frombuffer(body, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(400, "Invalid JPEG camera frame")

    result = get_model().track(
        frame, persist=True, conf=CONFIDENCE_THRESHOLD, verbose=False
    )[0]
    detections: list[dict] = []
    boxes = result.boxes
    if boxes is not None:
        ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
        for track_id, cls_id, score, xyxy in zip(
            ids,
            boxes.cls.int().cpu().tolist(),
            boxes.conf.cpu().tolist(),
            boxes.xyxy.cpu().tolist(),
        ):
            if int(cls_id) != PERSON_CLASS_ID:
                continue
            detections.append(
                {
                    "track_id": track_id,
                    "label": "person",
                    "confidence": round(float(score), 4),
                    "bbox": [round(float(v), 2) for v in xyxy],
                }
            )

    timestamp = time.time()
    payload = {
        "kind": "detection",
        "camera_id": camera_id,
        "timestamp": timestamp,
        "detections": detections,
        "person_detected": bool(detections),
        "person_count": len(detections),
        "source": "browser-camera",
    }
    await hub.publish(payload)
    return payload
