"""Browser-camera ingestion for live BorderSight surveillance."""
from __future__ import annotations

import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request

from .inference_pipeline import get_model
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

    result = get_model().track(frame, persist=True, conf=0.45, verbose=False)[0]
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
            detections.append({
                "track_id": track_id,
                "label": result.names[int(cls_id)],
                "confidence": float(score),
                "bbox": [float(v) for v in xyxy],
            })

    timestamp = time.time()
    await hub.publish({
        "kind": "detection",
        "camera_id": camera_id,
        "timestamp": timestamp,
        "detections": detections,
        "source": "browser-camera",
    })
    return {"camera_id": camera_id, "timestamp": timestamp, "detections": detections}
