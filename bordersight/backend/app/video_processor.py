"""Background CCTV processor for the BorderSight MVP.

Processes uploaded footage with OpenCV + YOLO and publishes detections to
our existing SSE hub. The worker is intentionally simple for Phase-2 and can
later move to Celery/RQ/GPU workers without changing the frontend contract.
"""
from __future__ import annotations

import asyncio
import cv2
from ultralytics import YOLO

from .border_engine import BorderEngine
from .event_bridge import publish_detection
from .video_api import jobs


async def process_job(job_id: str) -> None:
    job = jobs.get(job_id)
    if not job:
        return
    job["status"] = "processing"
    cap = cv2.VideoCapture(job["path"])
    if not cap.isOpened():
        job["status"] = "failed"
        job["error"] = "Unable to open uploaded video"
        return

    model = YOLO("yolo11n.pt")
    engine = BorderEngine()
    frame_no = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame_no += 1
            # Keep CPU demo processing reasonable while preserving a responsive UI.
            if frame_no % 2:
                continue
            result = model.track(frame, persist=True, conf=0.45, verbose=False)[0]
            detections = []
            events = []
            boxes = result.boxes
            if boxes is not None:
                ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
                classes = boxes.cls.int().cpu().tolist()
                scores = boxes.conf.cpu().tolist()
                coords = boxes.xyxy.cpu().tolist()
                for track_id, cls_id, score, xyxy in zip(ids, classes, scores, coords):
                    label = result.names[int(cls_id)]
                    detections.append({"track_id": track_id, "label": label, "confidence": float(score), "bbox": [float(v) for v in xyxy]})
                    if track_id is not None and label == "person":
                        x1, y1, x2, y2 = xyxy
                        center = (((x1 + x2) / 2) / frame.shape[1], ((y1 + y2) / 2) / frame.shape[0])
                        events.extend(engine.update(int(track_id), center, frame_no / fps, label))
            await publish_detection({"timestamp": frame_no / fps, "detections": detections, "events": events}, f"UPLOAD-{job_id}")
            job["progress"] = round((cap.get(cv2.CAP_PROP_POS_FRAMES) / max(cap.get(cv2.CAP_PROP_FRAME_COUNT), 1)) * 100, 1)
            await asyncio.sleep(0)
        job["status"] = "completed"
        job["progress"] = 100
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        cap.release()
