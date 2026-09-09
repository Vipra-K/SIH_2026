"""Single-pass background CCTV processor for the BorderSight MVP.

Uploaded footage is processed once through the shared inference pipeline.
The pipeline produces detections and annotated JPEG frames. This processor
handles BorderEngine rules, restriction-zone events, SSE events, and progress.
"""

from __future__ import annotations

import asyncio
import cv2

from .border_engine import BorderEngine
from .event_bridge import publish_detection
from .video_api import jobs
from .frame_store import reset
from .inference_pipeline import analyze_frame
from .zone_engine import ZoneViolationEngine


async def process_job(job_id: str) -> None:
    job = jobs.get(job_id)
    if not job:
        return

    job["status"] = "processing"
    job["progress"] = 0
    job["error"] = None
    reset(job_id)

    cap = cv2.VideoCapture(job["path"])
    if not cap.isOpened():
        job["status"] = "failed"
        job["error"] = "Unable to open uploaded video"
        return

    engine = BorderEngine()
    zone_engine = ZoneViolationEngine()
    camera_id = job.get("camera_id")

    frame_no = 0
    sequence = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = max(cap.get(cv2.CAP_PROP_FRAME_COUNT), 1)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame_no += 1
            if frame_no % 2:
                continue

            result, detections, zone_events = analyze_frame(
                job_id=job_id,
                frame=frame,
                sequence=sequence + 1,
                camera_id=camera_id,
                zone_engine=zone_engine,
            )
            sequence += 1

            events = []
            boxes = result.boxes
            if boxes is not None and boxes.id is not None:
                track_ids = boxes.id.int().cpu().tolist()
                coordinates = boxes.xyxy.cpu().tolist()
                for track_id, xyxy in zip(track_ids, coordinates):
                    detection = next((item for item in detections if item["track_id"] == track_id), None)
                    if not detection or detection["label"] != "person":
                        continue
                    x1, y1, x2, y2 = xyxy
                    center = (((x1 + x2) / 2) / frame.shape[1], ((y1 + y2) / 2) / frame.shape[0])
                    events.extend(engine.update(int(track_id), center, frame_no / fps, detection["label"]))

            events.extend(zone_events)
            await publish_detection(
                {
                    "timestamp": frame_no / fps,
                    "detections": detections,
                    "events": events,
                    "zone_violations": zone_events,
                    "source": "upload",
                    "job_id": job_id,
                },
                f"UPLOAD-{job_id}",
            )

            current_frame = cap.get(cv2.CAP_PROP_POS_FRAMES)
            job["progress"] = round((current_frame / total_frames) * 100, 1)
            await asyncio.sleep(0)

        job["status"] = "completed"
        job["progress"] = 100
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        cap.release()
